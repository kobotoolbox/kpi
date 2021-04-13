# coding: utf-8
# 😬
import copy
import sys
from collections import OrderedDict
from functools import reduce
from io import BytesIO
from operator import add
from typing import Union

import six
import xlsxwriter
from django.conf import settings
from django.contrib.auth.models import Permission
from django.contrib.postgres.fields import JSONField as JSONBField
from django.db import models
from django.db import transaction
from django.db.models import Exists, OuterRef, Prefetch, Q
from django.utils.translation import ugettext_lazy as _
from taggit.managers import TaggableManager, _TaggableManager
from taggit.utils import require_instance_manager

from formpack import FormPack
from formpack.utils.flatten_content import flatten_content
from formpack.utils.json_hash import json_hash
from formpack.utils.kobo_locking import (
    revert_kobo_lock_structre,
    strip_kobo_locking_profile,
)
from formpack.utils.spreadsheet_content import flatten_to_spreadsheet_content
from kobo.apps.reports.constants import (SPECIFIC_REPORTS_KEY,
                                         DEFAULT_REPORTS_KEY)
from kpi.constants import (
    ASSET_TYPES,
    ASSET_TYPES_WITH_CONTENT,
    ASSET_TYPE_BLOCK,
    ASSET_TYPE_COLLECTION,
    ASSET_TYPE_EMPTY,
    ASSET_TYPE_QUESTION,
    ASSET_TYPE_SURVEY,
    ASSET_TYPE_TEMPLATE,
    ASSET_TYPE_TEXT,
    PERM_ADD_SUBMISSIONS,
    PERM_CHANGE_ASSET,
    PERM_CHANGE_SUBMISSIONS,
    PERM_DELETE_ASSET,
    PERM_DELETE_SUBMISSIONS,
    PERM_DISCOVER_ASSET,
    PERM_FROM_KC_ONLY,
    PERM_MANAGE_ASSET,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VALIDATE_SUBMISSIONS,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
    SUFFIX_SUBMISSIONS_PERMS,
)
from kpi.deployment_backends.mixin import DeployableMixin
from kpi.exceptions import BadPermissionsException
from kpi.fields import KpiUidField, LazyDefaultJSONBField
from kpi.utils.asset_content_analyzer import AssetContentAnalyzer
from kpi.utils.asset_translation_utils import (
    compare_translations,
    # TRANSLATIONS_EQUAL,
    TRANSLATIONS_OUT_OF_ORDER,
    TRANSLATION_RENAMED,
    TRANSLATION_DELETED,
    TRANSLATION_ADDED,
    TRANSLATION_CHANGE_UNSUPPORTED,
    TRANSLATIONS_MULTIPLE_CHANGES,
)
from kpi.utils.autoname import (autoname_fields_in_place,
                                autovalue_choices_in_place)
from kpi.utils.kobo_to_xlsform import (expand_rank_and_score_in_place,
                                       replace_with_autofields,
                                       remove_empty_expressions_in_place)
from kpi.utils.log import logging
from kpi.utils.random_id import random_id
from kpi.utils.sluggify import sluggify_label
from kpi.utils.standardize_content import (needs_standardization,
                                           standardize_content_in_place)
from .asset_user_partial_permission import AssetUserPartialPermission
from .asset_version import AssetVersion
from .object_permission import ObjectPermissionMixin, get_cached_code_names


# TODO: Would prefer this to be a mixin that didn't derive from `Manager`.
class AssetManager(models.Manager):
    def create(self, *args, children_to_create=None, tag_string=None, **kwargs):
        update_parent_languages = kwargs.pop('update_parent_languages', True)

        # 3 lines below are copied from django.db.models.query.QuerySet.create()
        # because we need to pass an argument to save()
        # (and the default Django create() does not allow that)
        created = self.model(**kwargs)
        self._for_write = True
        created.save(force_insert=True, using=self.db,
                     update_parent_languages=update_parent_languages)

        if tag_string:
            created.tag_string = tag_string
        if children_to_create:
            new_assets = []
            for asset in children_to_create:
                asset['parent'] = created
                new_assets.append(Asset.objects.create(
                    update_parent_languages=False, **asset))
            created.update_languages(new_assets)
        return created

    def deployed(self):
        """
        Filter for deployed assets (i.e. assets having at least one deployed
        version) in an efficient way that doesn't involve joining or counting.
        https://docs.djangoproject.com/en/2.2/ref/models/expressions/#django.db.models.Exists
        """
        deployed_versions = AssetVersion.objects.filter(
            asset=OuterRef('pk'), deployed=True
        )
        return self.annotate(deployed=Exists(deployed_versions)).filter(
            deployed=True
        )

    def filter_by_tag_name(self, tag_name):
        return self.filter(tags__name=tag_name)


class KpiTaggableManager(_TaggableManager):
    @require_instance_manager
    def add(self, *tags, **kwargs):
        """ A wrapper that replaces spaces in tag names with dashes and also
        strips leading and trailng whitespace. Behavior should match the
        TagsInput transform function in app.es6. """
        tags_out = []
        for t in tags:
            # Modify strings only; the superclass' add() method will then
            # create Tags or use existing ones as appropriate.  We do not fix
            # existing Tag objects, which could also be passed into this
            # method, because a fixed name could collide with the name of
            # another Tag object already in the database.
            if isinstance(t, str):
                t = t.strip().replace(' ', '-')
            tags_out.append(t)
        super().add(*tags_out, **kwargs)


FLATTEN_OPTS = {
    'remove_columns': {
        'survey': [
            '$prev',
            'select_from_list_name',
            '_or_other',
        ],
        'choices': []
    },
    'remove_sheets': [
        'schema',
    ],
}


class FormpackXLSFormUtils:
    def _standardize(self, content):
        if needs_standardization(content):
            standardize_content_in_place(content)
            return True
        else:
            return False

    def _autoname(self, content):
        autoname_fields_in_place(content, '$autoname')
        autovalue_choices_in_place(content, '$autovalue')

    def _populate_fields_with_autofields(self, content):
        replace_with_autofields(content)

    def _expand_kobo_qs(self, content):
        expand_rank_and_score_in_place(content)

    def _ensure_settings(self, content):
        # asset.settings should exist already, but
        # on some legacy forms it might not
        _settings = OrderedDict(content.get('settings', {}))
        if isinstance(_settings, list):
            if len(_settings) > 0:
                _settings = OrderedDict(_settings[0])
            else:
                _settings = OrderedDict()
        if not isinstance(_settings, dict):
            _settings = OrderedDict()
        content['settings'] = _settings

    def _append(self, content, **sheet_data):
        settings = sheet_data.pop('settings', None)
        if settings:
            self._ensure_settings(content)
            content['settings'].update(settings)
        for (sht, rows) in sheet_data.items():
            if sht in content:
                content[sht] += rows

    def _xlsform_structure(self, content, ordered=True, kobo_specific=False):
        opts = copy.deepcopy(FLATTEN_OPTS)
        if not kobo_specific:
            opts['remove_columns']['survey'].append('$kuid')
            opts['remove_columns']['survey'].append('$autoname')
            opts['remove_columns']['choices'].append('$kuid')
            opts['remove_columns']['choices'].append('$autovalue')
        if ordered:
            if not isinstance(content, OrderedDict):
                raise TypeError('content must be an ordered dict if '
                                'ordered=True')
            flatten_to_spreadsheet_content(content, in_place=True,
                                           **opts)
        else:
            flatten_content(content, in_place=True, **opts)

    def _assign_kuids(self, content):
        for row in content['survey']:
            if '$kuid' not in row:
                row['$kuid'] = random_id(9)
        for row in content.get('choices', []):
            if '$kuid' not in row:
                row['$kuid'] = random_id(9)

    def _strip_kuids(self, content):
        # this is important when stripping out kobo-specific types because the
        # $kuid field in the xform prevents cascading selects from rendering
        for row in content['survey']:
            row.pop('$kuid', None)
        for row in content.get('choices', []):
            row.pop('$kuid', None)

    def _link_list_items(self, content):
        arr = content['survey']
        if len(arr) > 0:
            arr[0]['$prev'] = None
        for i in range(1, len(arr)):
            arr[i]['$prev'] = arr[i-1]['$kuid']

    def _unlink_list_items(self, content):
        arr = content['survey']
        for row in arr:
            if '$prev' in row:
                del row['$prev']

    def _revert_kobo_lock_structre(self, content):
        revert_kobo_lock_structre(content)

    def _strip_kobo_locking_profile(self, content):
        strip_kobo_locking_profile(content)

    def _remove_empty_expressions(self, content):
        remove_empty_expressions_in_place(content)

    def _make_default_translation_first(self, content):
        # The form builder only shows the first language, so make sure the
        # default language is always at the top of the translations list. The
        # new translations UI, on the other hand, shows all languages:
        # https://github.com/kobotoolbox/kpi/issues/1273
        try:
            default_translation_name = content['settings']['default_language']
        except KeyError:
            # No `default_language`; don't do anything
            return
        else:
            self._prioritize_translation(content, default_translation_name)

    def _strip_empty_rows(self, content, vals=None):
        if vals is None:
            vals = {
                'survey': 'type',
                'choices': 'list_name',
            }
        for sheet_name, required_key in vals.items():
            arr = content.get(sheet_name, [])
            arr[:] = [row for row in arr if required_key in row]

    def pop_setting(self, content, *args):
        if 'settings' in content:
            return content['settings'].pop(*args)

    def _rename_null_translation(self, content, new_name):
        if new_name in content['translations']:
            raise ValueError('Cannot save translation with duplicate '
                             'name: {}'.format(new_name))

        try:
            _null_index = content['translations'].index(None)
        except ValueError:
            raise ValueError('Cannot save translation name: {}'.format(
                             new_name))
        content['translations'][_null_index] = new_name

    def _has_translations(self, content, min_count=1):
        return len(content.get('translations', [])) >= min_count

    def update_translation_list(self, translation_list):
        existing_ts = self.content.get('translations', [])
        params = compare_translations(existing_ts,
                                      translation_list)
        if None in translation_list and translation_list[0] is not None:
            raise ValueError('Unnamed translation must be first in '
                             'list of translations')
        if TRANSLATIONS_OUT_OF_ORDER in params:
            self._reorder_translations(self.content, translation_list)
        elif TRANSLATION_RENAMED in params:
            _change = params[TRANSLATION_RENAMED]['changes'][0]
            self._rename_translation(self.content, _change['from'],
                                     _change['to'])
        elif TRANSLATION_ADDED in params:
            if None in existing_ts:
                raise ValueError('cannot add translation if an unnamed translation exists')
            self._prepend_translation(self.content, params[TRANSLATION_ADDED])
        elif TRANSLATION_DELETED in params:
            if params[TRANSLATION_DELETED] != existing_ts[-1]:
                raise ValueError('you can only delete the last translation of the asset')
            self._remove_last_translation(self.content)
        else:
            for chg in [
                        TRANSLATIONS_MULTIPLE_CHANGES,
                        TRANSLATION_CHANGE_UNSUPPORTED,
                        ]:
                if chg in params:
                    raise ValueError(
                        'Unsupported change: "{}": {}'.format(
                            chg,
                            params[chg]
                            )
                    )

    def _prioritize_translation(self, content, translation_name, is_new=False):
        # the translations/languages present this particular content
        _translations = content['translations']
        # the columns that have translations
        _translated = content.get('translated', [])
        if is_new and (translation_name in _translations):
            raise ValueError('cannot add existing translation')
        elif (not is_new) and (translation_name not in _translations):
            # if there are no translations available, don't try to prioritize,
            # just ignore the translation `translation_name`
            if len(_translations) == 1 and _translations[0] is None:
                return
            else:  # Otherwise raise an error.
                # Remove None from translations we want to display to users
                valid_translations = [t for t in _translations if t is not None]
                raise ValueError("`{translation_name}` is specified as the default language, "
                                 "but only these translations are present in the form: `{translations}`".format(
                                    translation_name=translation_name,
                                    translations="`, `".join(valid_translations)
                                    )
                                 )

        _tindex = -1 if is_new else _translations.index(translation_name)
        if is_new or (_tindex > 0):
            for sheet_name in 'survey', 'choices':
                for row in content.get(sheet_name, []):
                    for col in _translated:
                        if is_new:
                            val = '{}'.format(row[col][0])
                        else:
                            try:
                                val = row[col].pop(_tindex)
                            except KeyError:
                                continue
                        row[col].insert(0, val)
            if is_new:
                _translations.insert(0, translation_name)
            else:
                _translations.insert(0, _translations.pop(_tindex))

    def _remove_last_translation(self, content):
        content.get('translations').pop()
        _translated = content.get('translated', [])
        for row in content.get('survey', []):
            for col in _translated:
                row[col].pop()
        for row in content.get('choices', []):
            for col in _translated:
                row[col].pop()

    def _prepend_translation(self, content, translation_name):
        self._prioritize_translation(content, translation_name, is_new=True)

    def _reorder_translations(self, content, translations):
        _ts = translations[:]
        _ts.reverse()
        for _tname in _ts:
            self._prioritize_translation(content, _tname)

    def _rename_translation(self, content, _from, _to):
        _ts = content.get('translations')
        if _to in _ts:
            raise ValueError('Duplicate translation: {}'.format(_to))
        _ts[_ts.index(_from)] = _to


class XlsExportable:
    def ordered_xlsform_content(self,
                                kobo_specific_types=False,
                                append=None):
        # currently, this method depends on "FormpackXLSFormUtils"
        content = copy.deepcopy(self.content)
        if append:
            self._append(content, **append)
        self._standardize(content)
        if not kobo_specific_types:
            self._expand_kobo_qs(content)
            self._autoname(content)
            self._populate_fields_with_autofields(content)
            self._strip_kuids(content)
            self._revert_kobo_lock_structre(content)
        content = OrderedDict(content)
        self._xlsform_structure(content, ordered=True, kobo_specific=kobo_specific_types)
        return content

    def to_xls_io(self, versioned=False, **kwargs):
        """
        To append rows to one or more sheets, pass `append` as a
        dictionary of lists of dictionaries in the following format:
            `{'sheet name': [{'column name': 'cell value'}]}`
        Extra settings may be included as a dictionary in the same
        parameter.
            `{'settings': {'setting name': 'setting value'}}`
        """
        if versioned:
            append = kwargs.setdefault('append', {})
            append_survey = append.setdefault('survey', [])
            # We want to keep the order and append `version` at the end.
            append_settings = OrderedDict(append.setdefault('settings', {}))
            append_survey.append(
                {'name': '__version__',
                 'calculation': '\'{}\''.format(self.version_id),
                 'type': 'calculate'}
            )
            append_settings.update({'version': self.version_number_and_date})
            kwargs['append']['settings'] = append_settings
        try:
            def _add_contents_to_sheet(sheet, contents):
                cols = []
                for row in contents:
                    for key in row.keys():
                        if key not in cols:
                            cols.append(key)
                for ci, col in enumerate(cols):
                    sheet.write(0, ci, col)
                for ri, row in enumerate(contents):
                    for ci, col in enumerate(cols):
                        val = row.get(col, None)
                        if val:
                            sheet.write(ri + 1, ci, val)
            # The extra rows and settings should persist within this function
            # and its return value *only*. Calling deepcopy() is required to
            # achieve this isolation.
            ss_dict = self.ordered_xlsform_content(**kwargs)
            output = BytesIO()
            with xlsxwriter.Workbook(output) as workbook:
                for sheet_name, contents in ss_dict.items():
                    cur_sheet = workbook.add_worksheet(sheet_name)
                    _add_contents_to_sheet(cur_sheet, contents)
        except Exception as e:
            six.reraise(
                type(e),
                type(e)(
                    "asset.content improperly formatted for XLS "
                    "export: %s" % repr(e)
                ),
                sys.exc_info()[2],
            )

        output.seek(0)
        return output


class Asset(ObjectPermissionMixin,
            DeployableMixin,
            XlsExportable,
            FormpackXLSFormUtils,
            models.Model):
    name = models.CharField(max_length=255, blank=True, default='')
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)
    content = JSONBField(default=dict)
    summary = JSONBField(default=dict)
    report_styles = JSONBField(default=dict)
    report_custom = JSONBField(default=dict)
    map_styles = LazyDefaultJSONBField(default=dict)
    map_custom = LazyDefaultJSONBField(default=dict)
    asset_type = models.CharField(
        choices=ASSET_TYPES, max_length=20, default=ASSET_TYPE_SURVEY)
    parent = models.ForeignKey('Asset', related_name='children',
                               null=True, blank=True, on_delete=models.CASCADE)
    owner = models.ForeignKey('auth.User', related_name='assets', null=True,
                              on_delete=models.CASCADE)
    uid = KpiUidField(uid_prefix='a')
    tags = TaggableManager(manager=KpiTaggableManager)
    settings = JSONBField(default=dict)

    # _deployment_data should be accessed through the `deployment` property
    # provided by `DeployableMixin`
    _deployment_data = JSONBField(default=dict)

    objects = AssetManager()

    @property
    def kind(self):
        return 'asset'

    class Meta:

        # Example in Django documentation  represents `ordering` as a list
        # (even if it can be a list or a tuple). We enforce the type to `list`
        # because `rest_framework.filters.OrderingFilter` work with lists.
        # `AssetOrderingFilter` inherits from this class and it is used `
        # in `AssetViewSet to sort the result.
        # It avoids back and forth between types and/or coercing where
        # ordering is needed
        ordering = [
            '-date_modified',
        ]

        permissions = (
            # change_, add_, and delete_asset are provided automatically
            # by Django
            (PERM_VIEW_ASSET, _('Can view asset')),
            (PERM_DISCOVER_ASSET, _('Can discover asset in public lists')),
            (PERM_MANAGE_ASSET, _('Can manage all aspects of asset')),
            # Permissions for collected data, i.e. submissions
            (PERM_ADD_SUBMISSIONS, _('Can submit data to asset')),
            (PERM_VIEW_SUBMISSIONS, _('Can view submitted data for asset')),
            (PERM_PARTIAL_SUBMISSIONS, _('Can make partial actions on '
                                         'submitted data for asset '
                                         'for specific users')),
            (PERM_CHANGE_SUBMISSIONS, _('Can modify submitted data for asset')),
            (PERM_DELETE_SUBMISSIONS, _('Can delete submitted data for asset')),
            (PERM_VALIDATE_SUBMISSIONS, _("Can validate submitted data asset")),
            # TEMPORARY Issue #1161: A flag to indicate that permissions came
            # solely from `sync_kobocat_xforms` and not from any user
            # interaction with KPI
            (PERM_FROM_KC_ONLY, 'INTERNAL USE ONLY; DO NOT ASSIGN')
        )

        # Since Django 2.1, 4 permissions are added for each registered model:
        # - add
        # - change
        # - delete
        # - view
        # See https://docs.djangoproject.com/en/2.2/topics/auth/default/#default-permissions
        # for more detail.
        # `view_asset` clashes with newly built-in one.
        # The simplest way to fix this is to keep old behaviour
        default_permissions = ('add', 'change', 'delete')

    # Labels for each `asset_type` as they should be presented to users. Can be
    # strings or callables if special logic is needed. Callables receive the
    # codename of the permission for which a label is being created
    ASSET_TYPE_LABELS_FOR_PERMISSIONS = {
        ASSET_TYPE_SURVEY: (
            lambda p: _('project') if p == PERM_MANAGE_ASSET else _('form')
        ),
        ASSET_TYPE_TEMPLATE: _('template'),
        ASSET_TYPE_BLOCK: _('block'),
        ASSET_TYPE_QUESTION: _('question'),
        ASSET_TYPE_TEXT: _('text'),  # unused?
        ASSET_TYPE_EMPTY: _('empty'),  # unused?
        ASSET_TYPE_COLLECTION: _('collection'),
    }

    # Assignable permissions that are stored in the database.
    # The labels are templates used by `get_label_for_permission()`, which you
    # should call instead of accessing this dictionary directly
    ASSIGNABLE_PERMISSIONS_WITH_LABELS = {
        PERM_VIEW_ASSET: _('View ##asset_type_label##'),
        PERM_CHANGE_ASSET: _('Edit ##asset_type_label##'),
        PERM_DISCOVER_ASSET: _('Discover ##asset_type_label##'),
        PERM_MANAGE_ASSET: _('Manage ##asset_type_label##'),
        PERM_ADD_SUBMISSIONS: _('Add submissions'),
        PERM_VIEW_SUBMISSIONS: _('View submissions'),
        PERM_PARTIAL_SUBMISSIONS: _('View submissions only from specific users'),
        PERM_CHANGE_SUBMISSIONS: _('Edit submissions'),
        PERM_DELETE_SUBMISSIONS: _('Delete submissions'),
        PERM_VALIDATE_SUBMISSIONS: _('Validate submissions'),
    }
    ASSIGNABLE_PERMISSIONS = tuple(ASSIGNABLE_PERMISSIONS_WITH_LABELS.keys())
    # Depending on our `asset_type`, only some permissions might be applicable
    ASSIGNABLE_PERMISSIONS_BY_TYPE = {
        ASSET_TYPE_SURVEY: tuple(
            (p for p in ASSIGNABLE_PERMISSIONS if p != PERM_DISCOVER_ASSET)
        ),
        ASSET_TYPE_TEMPLATE: (
            PERM_VIEW_ASSET,
            PERM_CHANGE_ASSET,
            PERM_MANAGE_ASSET,
        ),
        ASSET_TYPE_BLOCK: (
            PERM_VIEW_ASSET,
            PERM_CHANGE_ASSET,
            PERM_MANAGE_ASSET,
        ),
        ASSET_TYPE_QUESTION: (
            PERM_VIEW_ASSET,
            PERM_CHANGE_ASSET,
            PERM_MANAGE_ASSET,
        ),
        ASSET_TYPE_TEXT: (),  # unused?
        ASSET_TYPE_EMPTY: (
            PERM_VIEW_ASSET,
            PERM_CHANGE_ASSET,
            PERM_MANAGE_ASSET,
        ),
        ASSET_TYPE_COLLECTION: (
            PERM_VIEW_ASSET,
            PERM_CHANGE_ASSET,
            PERM_DISCOVER_ASSET,
            PERM_MANAGE_ASSET,
        ),
    }

    # Calculated permissions that are neither directly assignable nor stored
    # in the database, but instead implied by assignable permissions
    CALCULATED_PERMISSIONS = (
        PERM_DELETE_ASSET,
    )
    # Only certain permissions can be inherited
    HERITABLE_PERMISSIONS = {
        # parent permission: child permission
        PERM_VIEW_ASSET: PERM_VIEW_ASSET,
        PERM_CHANGE_ASSET: PERM_CHANGE_ASSET
    }
    # Granting some permissions implies also granting other permissions
    IMPLIED_PERMISSIONS = {
        # Format: explicit: (implied, implied, ...)
        PERM_CHANGE_ASSET: (PERM_VIEW_ASSET,),
        PERM_DISCOVER_ASSET: (PERM_VIEW_ASSET,),
        PERM_MANAGE_ASSET: tuple(
            (
                p
                for p in ASSIGNABLE_PERMISSIONS
                if p not in (PERM_MANAGE_ASSET, PERM_PARTIAL_SUBMISSIONS)
            )
        ),
        PERM_ADD_SUBMISSIONS: (PERM_VIEW_ASSET,),
        PERM_VIEW_SUBMISSIONS: (PERM_VIEW_ASSET,),
        PERM_PARTIAL_SUBMISSIONS: (PERM_VIEW_ASSET,),
        PERM_CHANGE_SUBMISSIONS: (PERM_VIEW_SUBMISSIONS,),
        PERM_DELETE_SUBMISSIONS: (PERM_VIEW_SUBMISSIONS,),
        PERM_VALIDATE_SUBMISSIONS: (PERM_VIEW_SUBMISSIONS,),
    }

    CONTRADICTORY_PERMISSIONS = {
        PERM_PARTIAL_SUBMISSIONS: (
            PERM_VIEW_SUBMISSIONS,
            PERM_CHANGE_SUBMISSIONS,
            PERM_DELETE_SUBMISSIONS,
            PERM_VALIDATE_SUBMISSIONS,
            PERM_MANAGE_ASSET,
        ),
        PERM_VIEW_SUBMISSIONS: (PERM_PARTIAL_SUBMISSIONS,),
        PERM_CHANGE_SUBMISSIONS: (PERM_PARTIAL_SUBMISSIONS,),
        PERM_DELETE_SUBMISSIONS: (PERM_PARTIAL_SUBMISSIONS,),
        PERM_VALIDATE_SUBMISSIONS: (PERM_PARTIAL_SUBMISSIONS,),
    }

    # Some permissions must be copied to KC
    KC_PERMISSIONS_MAP = {  # keys are KPI's codenames, values are KC's
        PERM_CHANGE_SUBMISSIONS: 'change_xform',  # "Can Edit" in KC UI
        PERM_VIEW_SUBMISSIONS: 'view_xform',  # "Can View" in KC UI
        PERM_ADD_SUBMISSIONS: 'report_xform',  # "Can submit to" in KC UI
        PERM_DELETE_SUBMISSIONS: 'delete_data_xform',  # "Can Delete Data" in KC UI
        PERM_VALIDATE_SUBMISSIONS: 'validate_xform',  # "Can Validate" in KC UI
    }
    KC_CONTENT_TYPE_KWARGS = {'app_label': 'logger', 'model': 'xform'}
    # KC records anonymous access as flags on the `XForm`
    KC_ANONYMOUS_PERMISSIONS_XFORM_FLAGS = {
        PERM_VIEW_SUBMISSIONS: {'shared': True, 'shared_data': True}
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.__previous_parent_id = self.parent_id

    def __str__(self):
        return '{} ({})'.format(self.name, self.uid)

    def adjust_content_on_save(self):
        """
        This is called on save by default if content exists.
        Can be disabled / skipped by calling with parameter:
        asset.save(adjust_content=False)
        """
        self._standardize(self.content)

        self._make_default_translation_first(self.content)
        self._strip_empty_rows(self.content)
        self._assign_kuids(self.content)
        self._autoname(self.content)
        self._unlink_list_items(self.content)
        self._remove_empty_expressions(self.content)

        settings = self.content['settings']
        _title = settings.pop('form_title', None)
        id_string = settings.get('id_string')
        filename = self.summary.pop('filename', None)
        if filename:
            # if we have filename available, set the id_string
            # and/or form_title from the filename.
            if not id_string:
                id_string = sluggify_label(filename)
                settings['id_string'] = id_string
            if not _title:
                _title = filename
        if self.asset_type not in [ASSET_TYPE_SURVEY, ASSET_TYPE_TEMPLATE]:
            # instead of deleting the settings, simply clear them out
            self.content['settings'] = {}
            self._strip_kobo_locking_profile(self.content)

        if _title is not None:
            self.name = _title

    def clone(self, version_uid=None):
        # not currently used, but this is how "to_clone_dict" should work
        return Asset.objects.create(**self.to_clone_dict(version=version_uid))

    def create_version(self) -> [AssetVersion, None]:
        """
        Create a version of current asset.
        Asset has to belong to `ASSET_TYPE_WITH_CONTENT` otherwise no version
        is created and `None` is returned.
        """
        if self.asset_type not in ASSET_TYPES_WITH_CONTENT:
            return

        return self.asset_versions.create(
            name=self.name,
            version_content=self.content,
            _deployment_data=self._deployment_data,
            # Any new version starts out as not-deployed,
            # even if the asset itself is already deployed.
            # Note: `asset_version.deployed` is set in the
            # serializer `DeploymentSerializer`
            deployed=False,
        )

    @property
    def deployed_versions(self):
        return self.asset_versions.filter(deployed=True).order_by(
            '-date_modified')

    @property
    def discoverable_when_public(self):
        # This property is only needed when `self` is a collection.
        # We want to make a distinction between a collection which is not
        # discoverable and an asset which is not a collection
        # (which implies cannot be discoverable)
        if self.asset_type != ASSET_TYPE_COLLECTION:
            return None

        return self.permissions.filter(permission__codename=PERM_DISCOVER_ASSET,
                                       user_id=settings.ANONYMOUS_USER_ID).exists()

    def get_filters_for_partial_perm(self, user_id, perm=PERM_VIEW_SUBMISSIONS):
        """
        Returns the list of filters for a specific permission `perm`
        and this specific asset.
        :param user_id:
        :param perm: see `constants.*_SUBMISSIONS`
        :return:
        """
        if not perm.endswith(SUFFIX_SUBMISSIONS_PERMS) or perm == PERM_PARTIAL_SUBMISSIONS:
            raise BadPermissionsException(_('Only partial permissions for '
                                            'submissions are supported'))

        perms = self.get_partial_perms(user_id, with_filters=True)
        if perms:
            return perms.get(perm)
        return None

    def get_label_for_permission(
        self, permission_or_codename: Union[Permission, str]
    ) -> str:
        """
        Get the correct label for a permission (object or codename) based on
        the type of this asset
        """
        try:
            codename = permission_or_codename.codename
            permission = permission_or_codename
        except AttributeError:
            codename = permission_or_codename
            permission = None

        try:
            label = self.ASSIGNABLE_PERMISSIONS_WITH_LABELS[codename]
        except KeyError:
            if permission:
                label = permission.name
            else:
                cached_code_names = get_cached_code_names()
                label = cached_code_names[codename]['name']

        asset_type_label = self.ASSET_TYPE_LABELS_FOR_PERMISSIONS[
            self.asset_type
        ]
        try:
            # Some labels may be callables
            asset_type_label = asset_type_label(codename)
        except TypeError:
            # Others are just strings
            pass

        label = label.replace(
            '##asset_type_label##',
            # Raises TypeError if not coerced explicitly
            str(asset_type_label)
        )
        return label

    def get_partial_perms(
        self, user_id: int, with_filters: bool = False
    ) -> Union[list, dict, None]:
        """
        Returns the list of permissions the user is restricted to,
        for this specific asset.
        If `with_filters` is `True`, it returns a dict of permissions (as keys)
        and the filters (as values) to apply on query to narrow down
        the results.

        For example:
        `get_partial_perms(user1_obj.id)` would return
        ```
        ['view_submissions',]
        ```

        `get_partial_perms(user1_obj.id, with_filters=True)` would return
        ```
        {
            'view_submissions: [
                {'_submitted_by': {'$in': ['user1', 'user2']}},
                {'_submitted_by': 'user3'}
            ],
        }
        ```

        If user doesn't have any partial permissions, it returns `None`.
        """

        perms = self.asset_partial_permissions.filter(user_id=user_id)\
            .values_list("permissions", flat=True).first()

        if perms:
            if with_filters:
                return perms
            else:
                return list(perms)

        return None

    @property
    def has_active_hooks(self):
        """
        Returns if asset has active hooks.
        Useful to update `kc.XForm.has_kpi_hooks` field.
        :return: {boolean}
        """
        return self.hooks.filter(active=True).exists()

    def has_subscribed_user(self, user_id):
        # This property is only needed when `self` is a collection.
        # We want to make a distinction between a collection which does not have
        # the subscribed user and an asset which is not a collection
        # (which implies cannot have subscriptions)
        if self.asset_type != ASSET_TYPE_COLLECTION:
            return None

        # ToDo: See if using a loop can reduce the number of SQL queries.
        return self.userassetsubscription_set.filter(user_id=user_id).exists()

    @property
    def latest_deployed_version(self):
        return self.deployed_versions.first()

    @property
    def latest_version(self):
        versions = None
        try:
            versions = self.prefetched_latest_versions
        except AttributeError:
            versions = self.asset_versions.order_by('-date_modified')
        try:
            return versions[0]
        except IndexError:
            return None

    @staticmethod
    def optimize_queryset_for_list(queryset):
        """ Used by serializers to improve performance when listing assets """
        queryset = queryset.defer(
            # Avoid pulling these from the database because they are often huge
            # and we don't need them for list views.
            'content', 'report_styles'
        ).select_related(
            # We only need `username`, but `select_related('owner__username')`
            # actually pulled in the entire `auth_user` table under Django 1.8.
            # In Django 1.9+, "select_related() prohibits non-relational fields
            # for nested relations."
            'owner',
        ).prefetch_related(
            'permissions__permission',
            'permissions__user',
            # `Prefetch(..., to_attr='prefetched_list')` stores the prefetched
            # related objects in a list (`prefetched_list`) that we can use in
            # other methods to avoid additional queries; see:
            # https://docs.djangoproject.com/en/1.8/ref/models/querysets/#prefetch-objects
            Prefetch('tags', to_attr='prefetched_tags'),
            Prefetch(
                'asset_versions',
                queryset=AssetVersion.objects.order_by(
                    '-date_modified'
                ).only('uid', 'asset', 'date_modified', 'deployed'),
                to_attr='prefetched_latest_versions',
            ),
        )
        return queryset

    def rename_translation(self, _from, _to):
        if not self._has_translations(self.content, 2):
            raise ValueError('no translations available')
        self._rename_translation(self.content, _from, _to)

    # todo: test and implement this method
    # todo 2019-04-25: Still needed, `revert_to_version` does the same?
    # def restore_version(self, uid):
    #     _version_to_restore = self.asset_versions.get(uid=uid)
    #     self.content = _version_to_restore.version_content
    #     self.name = _version_to_restore.name

    def revert_to_version(self, version_uid):
        av = self.asset_versions.get(uid=version_uid)
        self.content = av.version_content
        self.save()

    def save(self, *args, **kwargs):

        is_new = self.pk is None
        update_parent_languages = kwargs.pop('update_parent_languages', True)

        if self.asset_type not in ASSET_TYPES_WITH_CONTENT:
            # so long as all of the operations in this overridden `save()`
            # method pertain to content, bail out if it's impossible for this
            # asset to have content in the first place
            super().save(*args, **kwargs)
            return

        if self.content is None:
            self.content = {}

        # in certain circumstances, we don't want content to
        # be altered on save. (e.g. on asset.deploy())
        if kwargs.pop('adjust_content', True):
            self.adjust_content_on_save()

        # populate summary
        self._populate_summary()

        # infer asset_type only between question and block
        if self.asset_type in [ASSET_TYPE_QUESTION, ASSET_TYPE_BLOCK]:
            try:
                row_count = int(self.summary.get('row_count'))
            except TypeError:
                pass
            else:
                if row_count == 1:
                    self.asset_type = ASSET_TYPE_QUESTION
                elif row_count > 1:
                    self.asset_type = ASSET_TYPE_BLOCK

        self._populate_report_styles()

        _create_version = kwargs.pop('create_version', True)
        super().save(*args, **kwargs)

        # Update languages for parent and previous parent.
        # e.g. if an survey has been moved from one collection to another,
        # we want both collections to be updated.
        if self.parent is not None and update_parent_languages:
            if self.parent_id != self.__previous_parent_id and \
               self.__previous_parent_id is not None:
                try:
                    previous_parent = Asset.objects.get(
                        pk=self.__previous_parent_id)
                    previous_parent.update_languages()
                    self.__previous_parent_id = self.parent_id
                except Asset.DoesNotExist:
                    pass

            # If object is new, we can add its languages to its parent without
            # worrying about removing its old values. It avoids an extra query.
            if is_new:
                self.parent.update_languages([self])
            else:
                # Otherwise, because we cannot know which languages are from
                # this object, update will be perform with all parent's children.
                self.parent.update_languages()

        if _create_version:
            self.create_version()

    @property
    def snapshot(self):
        return self._snapshot(regenerate=False)

    @property
    def tag_string(self):
        try:
            tag_list = self.prefetched_tags
        except AttributeError:
            tag_names = self.tags.values_list('name', flat=True)
        else:
            tag_names = [t.name for t in tag_list]
        return ','.join(tag_names)

    @tag_string.setter
    def tag_string(self, value):
        intended_tags = value.split(',')
        self.tags.set(*intended_tags)

    def to_clone_dict(
            self,
            version: Union[str, AssetVersion] = None
    ) -> dict:
        """
        Returns a dictionary of the asset based on its version.

        :param version: Optional. It can be an object or its unique id
        :return dict
        """
        if not isinstance(version, AssetVersion):
            if version:
                version = self.asset_versions.get(uid=version)
            else:
                version = self.asset_versions.first()
                if not version:
                    version = self.create_version()

        return {
            'name': version.name,
            'content': version.version_content,
            'asset_type': self.asset_type,
            'tag_string': self.tag_string,
        }

    def to_ss_structure(self):
        return flatten_content(self.content, in_place=False)

    def update_languages(self, children=None):
        """
        Updates object's languages by aggregating all its children's languages

        Args:
            children (list<Asset>): Optional. When specified, `children`'s languages
            are merged with `self`'s languages. Otherwise, when it's `None`,
            DB is fetched to build the list according to `self.children`

        """
        # If object is not a collection, it should not have any children.
        # No need to go further.
        if self.asset_type != ASSET_TYPE_COLLECTION:
            return

        obj_languages = self.summary.get('languages', [])
        languages = set()

        if children:
            languages = set(obj_languages)
            children_languages = [child.summary.get('languages')
                                  for child in children
                                  if child.summary.get('languages')]
        else:
            children_languages = list(self.children
                                      .values_list('summary__languages',
                                                   flat=True)
                                      .exclude(Q(summary__languages=[]) |
                                               Q(summary__languages=[None]))
                                      .order_by())

        if children_languages:
            # Flatten `children_languages` to 1-dimension list.
            languages.update(reduce(add, children_languages))

        languages.discard(None)
        # Object of type set is not JSON serializable
        languages = list(languages)

        # If languages are still the same, no needs to update the object
        if sorted(obj_languages) == sorted(languages):
            return

        self.summary['languages'] = languages
        self.save(update_fields=['summary'])

    @property
    def version__content_hash(self):
        # Avoid reading the property `self.latest_version` more than once, since
        # it may execute a database query each time it's read
        latest_version = self.latest_version
        if latest_version:
            return latest_version.content_hash

    @property
    def version_id(self):
        # Avoid reading the property `self.latest_version` more than once, since
        # it may execute a database query each time it's read
        latest_version = self.latest_version
        if latest_version:
            return latest_version.uid

    @property
    def version_number_and_date(self) -> str:
        # Returns the count of all deployed versions (plus one for the current
        # version if it is not deployed) and the date the asset was last
        # modified
        count = self.deployed_versions.count()

        if not self.latest_version.deployed:
            count = count + 1

        return f'{count} {self.date_modified:(%Y-%m-%d %H:%M:%S)}'

    def _populate_report_styles(self):
        default = self.report_styles.get(DEFAULT_REPORTS_KEY, {})
        specifieds = self.report_styles.get(SPECIFIC_REPORTS_KEY, {})
        kuids_to_variable_names = self.report_styles.get('kuid_names', {})
        for (index, row) in enumerate(self.content.get('survey', [])):
            if '$kuid' not in row:
                if 'name' in row:
                    row['$kuid'] = json_hash([self.uid, row['name']])
                else:
                    row['$kuid'] = json_hash([self.uid, index, row])
            _identifier = row.get('name', row['$kuid'])
            kuids_to_variable_names[_identifier] = row['$kuid']
            if _identifier not in specifieds:
                specifieds[_identifier] = {}
        self.report_styles = {
            DEFAULT_REPORTS_KEY: default,
            SPECIFIC_REPORTS_KEY: specifieds,
            'kuid_names': kuids_to_variable_names,
        }

    def _populate_summary(self):
        if self.content is None:
            self.content = {}
            self.summary = {}
            return
        analyzer = AssetContentAnalyzer(**self.content)
        self.summary = analyzer.summary

    @transaction.atomic
    def _snapshot(self, regenerate=True):
        asset_version = self.latest_version

        try:
            snapshot = AssetSnapshot.objects.get(asset=self,
                                                 asset_version=asset_version)
            if regenerate:
                snapshot.delete()
                snapshot = False
        except AssetSnapshot.MultipleObjectsReturned:
            # how did multiple snapshots get here?
            snaps = AssetSnapshot.objects.filter(asset=self,
                                                 asset_version=asset_version)
            snaps.delete()
            snapshot = False
        except AssetSnapshot.DoesNotExist:
            snapshot = False

        if not snapshot:
            if self.name != '':
                form_title = self.name
            else:
                _settings = self.content.get('settings', {})
                form_title = _settings.get('id_string', 'Untitled')

            self._append(self.content, settings={
                'form_title': form_title,
            })
            snapshot = AssetSnapshot.objects.create(asset=self,
                                                    asset_version=asset_version,
                                                    source=self.content)
        return snapshot

    def _update_partial_permissions(self, user_id, perm, remove=False,
                                    partial_perms=None):
        """
        Updates partial permissions relation table according to `perm`.

        If `perm` == `PERM_PARTIAL_SUBMISSIONS`, then
        If `partial_perms` is not `None`, it should be a dict with filters mapped to
        their corresponding permission.
        Each filter is used to narrow down results when querying Mongo.
        e.g.:
        ```
            {
                'view_submissions': [{
                    '_submitted_by': {
                        '$in': [
                            'someuser',
                            'anotheruser'
                        ]
                    }
                }],
            }
        ```

        Even if we can only restrict an user to view another's submissions so far,
        this code wants to be future-proof and supports other permissions such as:
            - `change_submissions`
            - `validate_submissions`
        `partial_perms` could be passed as:
        ```
            {
                'change_submissions': [{
                    '_submitted_by': {
                        '$in': [
                            'someuser',
                            'anotheruser'
                        ]
                    }
                }]
                'validate_submissions': [{
                    '_submitted_by': 'someuser'
                }],
            }
        ```

        :param user_id: int.
        :param perm: str. see Asset.ASSIGNABLE_PERMISSIONS
        :param remove: boolean. Default is false.
        :param partial_perms: dict. Default is None.
        :return:
        """

        def clean_up_table():
            # Because of the unique constraint, there should be only
            # one record that matches this query.
            # We don't look for record existence to avoid extra query.
            self.asset_partial_permissions.filter(user_id=user_id).delete()

        if perm == PERM_PARTIAL_SUBMISSIONS:

            if remove:
                clean_up_table()
                return

            if user_id == self.owner.pk:
                raise BadPermissionsException(
                    _("Can not assign '{}' permission to owner".format(perm)))

            if not partial_perms:
                raise BadPermissionsException(
                    _("Can not assign '{}' permission. "
                      "Partial permissions are missing.".format(perm)))

            new_partial_perms = {}
            for partial_perm, filters in partial_perms.items():
                implied_perms = [implied_perm
                                 for implied_perm in
                                 self.get_implied_perms(partial_perm)
                                 if implied_perm.endswith(SUFFIX_SUBMISSIONS_PERMS)
                                 ]
                implied_perms.append(partial_perm)
                for implied_perm in implied_perms:
                    if implied_perm not in new_partial_perms:
                        new_partial_perms[implied_perm] = []
                    new_partial_perms[implied_perm] += filters

            AssetUserPartialPermission.objects.update_or_create(
                asset_id=self.pk,
                user_id=user_id,
                defaults={'permissions': new_partial_perms})

        elif perm in self.CONTRADICTORY_PERMISSIONS.get(PERM_PARTIAL_SUBMISSIONS):
            clean_up_table()


class AssetSnapshot(models.Model, XlsExportable, FormpackXLSFormUtils):
    """
    This model serves as a cache of the XML that was exported by the installed
    version of pyxform.

    TODO: come up with a policy to clear this cache out.
    DO NOT: depend on these snapshots existing for more than a day
    until a policy is set.
    Done with https://github.com/kobotoolbox/kpi/pull/2434.
    Remove above lines when PR is merged
    """
    xml = models.TextField()
    source = JSONBField(default=dict)
    details = JSONBField(default=dict)
    owner = models.ForeignKey('auth.User', related_name='asset_snapshots',
                              null=True, on_delete=models.CASCADE)
    asset = models.ForeignKey(Asset, null=True, on_delete=models.CASCADE)
    _reversion_version_id = models.IntegerField(null=True)
    asset_version = models.OneToOneField('AssetVersion',
                                         on_delete=models.CASCADE,
                                         null=True)
    date_created = models.DateTimeField(auto_now_add=True)
    uid = KpiUidField(uid_prefix='s')

    @property
    def content(self):
        return self.source

    def save(self, *args, **kwargs):
        if self.asset is not None:
            # Previously, `self.source` was a nullable field. It must now
            # either contain valid content or be an empty dictionary.
            assert self.asset is not None
            if not self.source:
                if self.asset_version is None:
                    self.asset_version = self.asset.latest_version
                self.source = self.asset_version.version_content
            if self.owner is None:
                self.owner = self.asset.owner
        _note = self.details.pop('note', None)
        _source = copy.deepcopy(self.source)
        self._standardize(_source)
        self._make_default_translation_first(_source)
        self._strip_empty_rows(_source)
        self._autoname(_source)
        self._remove_empty_expressions(_source)
        _settings = _source.get('settings', {})
        form_title = _settings.get('form_title')
        id_string = _settings.get('id_string')

        self.xml, self.details = \
            self.generate_xml_from_source(_source,
                                          include_note=_note,
                                          root_node_name='data',
                                          form_title=form_title,
                                          id_string=id_string)
        self.source = _source
        return super().save(*args, **kwargs)

    def generate_xml_from_source(self,
                                 source,
                                 include_note=False,
                                 root_node_name='snapshot_xml',
                                 form_title=None,
                                 id_string=None):
        if form_title is None:
            form_title = 'Snapshot XML'
        if id_string is None:
            id_string = 'snapshot_xml'

        if include_note and 'survey' in source:
            _translations = source.get('translations', [])
            _label = include_note
            if len(_translations) > 0:
                _label = [_label for t in _translations]
            source['survey'].append({'type': 'note',
                                     'name': 'prepended_note',
                                     'label': _label})

        source_copy = copy.deepcopy(source)
        self._expand_kobo_qs(source_copy)
        self._populate_fields_with_autofields(source_copy)
        self._strip_kuids(source_copy)

        warnings = []
        details = {}
        try:
            xml = FormPack({'content': source_copy},
                           root_node_name=root_node_name,
                           id_string=id_string,
                           title=form_title)[0].to_xml(warnings=warnings)

            details.update({
                'status': 'success',
                'warnings': warnings,
            })
        except Exception as err:
            err_message = str(err)
            logging.error('Failed to generate xform for asset', extra={
                'src': source,
                'id_string': id_string,
                'uid': self.uid,
                '_msg': err_message,
                'warnings': warnings,
            })
            xml = ''
            details.update({
                'status': 'failure',
                'error_type': type(err).__name__,
                'error': err_message,
                'warnings': warnings,
            })
        return xml, details


class UserAssetSubscription(models.Model):
    """ Record a user's subscription to a publicly-discoverable collection,
    i.e. one where the anonymous user has been granted `discover_asset` """
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE)
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    uid = KpiUidField(uid_prefix='b')

    class Meta:
        unique_together = ('asset', 'user')
