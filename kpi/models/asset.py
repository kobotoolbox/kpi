# coding: utf-8
# 😬
import copy
import sys
import json
from collections import OrderedDict
from io import BytesIO

import six
import xlsxwriter
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.fields import GenericRelation
from django.contrib.contenttypes.models import ContentType
from django.contrib.postgres.fields import JSONField as JSONBField
from django.db import models
from django.db import transaction
from django.db.models import Exists, OuterRef, Prefetch
from django.utils.translation import ugettext_lazy as _
from jsonfield import JSONField
from taggit.managers import TaggableManager, _TaggableManager
from taggit.utils import require_instance_manager

from kpi.utils.kobo_content import (
    KoboContent,
    empty_content,
    get_content_object,
)

from formpack import FormPack
from formpack.utils.flatten_content import flatten_content
from formpack.utils.json_hash import json_hash
from formpack.utils.spreadsheet_content import flatten_to_spreadsheet_content
from kobo.apps.reports.constants import (SPECIFIC_REPORTS_KEY,
                                         DEFAULT_REPORTS_KEY)

from kpi.constants import (
    ASSET_TYPES,
    ASSET_TYPE_BLOCK,
    ASSET_TYPE_EMPTY,
    ASSET_TYPE_QUESTION,
    ASSET_TYPE_SURVEY,
    ASSET_TYPE_TEMPLATE,
    ASSET_TYPE_TEXT,
    PERM_ADD_SUBMISSIONS,
    PERM_CHANGE_ASSET,
    PERM_CHANGE_COLLECTION,
    PERM_CHANGE_SUBMISSIONS,
    PERM_DELETE_ASSET,
    PERM_DELETE_SUBMISSIONS,
    PERM_FROM_KC_ONLY,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_SHARE_ASSET,
    PERM_SHARE_SUBMISSIONS,
    PERM_VALIDATE_SUBMISSIONS,
    PERM_VIEW_ASSET,
    PERM_VIEW_COLLECTION,
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
from .asset_user_partial_permission import AssetUserPartialPermission
from .asset_version import AssetVersion
from .object_permission import ObjectPermission, ObjectPermissionMixin


# TODO: Would prefer this to be a mixin that didn't derive from `Manager`.
class TaggableModelManager(models.Manager):

    def create(self, *args, **kwargs):
        tag_string = kwargs.pop('tag_string', None)
        created = super().create(*args, **kwargs)
        if tag_string:
            created.tag_string = tag_string
        return created


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


class AssetManager(TaggableModelManager):
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


# TODO: Merge this functionality into the eventual common base class of `Asset`
# and `Collection`.
class TagStringMixin:

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


class XlsExportable:
    def ordered_xlsform_content(self,
                                kobo_specific_types=False,
                                append=None):
        # currently, this method depends on "FormpackXLSFormUtils"
        content = get_content_object(self.content).export_to('2')
        if append:
            if 'settings' in append:
                content['settings'].update(append.pop('settings'))
            if 'survey' in append:
                content['survey'].extend(append.pop('survey'))
        return KoboContent(content, validate=True).export_to('xlsform')

    def to_xls_io(self, versioned=False, **kwargs):
        """
        To append rows to one or more sheets, pass `append` as a
        dictionary of lists of dictionaries in the following format:
            `{'sheet name': [{'column name': 'cell value'}]}`
        Extra settings may be included as a dictionary in the same
        parameter.
            `{'settings': {'setting name': 'setting value'}}`
        """
        # todo: handle "versioned"
        if versioned:
            append = kwargs.setdefault('append', {})
            append_survey = append.setdefault('survey', [])
            # We want to keep the order and append `version` at the end.
            append_settings = OrderedDict(append.setdefault('settings', {}))
            append_survey.append(
                {'name': '__version__',
                 'calculation': '\'{}\''.format(self.version_id),
                 '$anchor': '_version__',
                 'type': 'calculate'}
            )
            append_settings.update({'version': self.version_id})
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
                    if sheet_name in ['schema', 'translated', '']:
                        continue
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
            TagStringMixin,
            DeployableMixin,
            XlsExportable,
            models.Model):
    name = models.CharField(max_length=255, blank=True, default='')
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)
    content = JSONField(default=dict)
    summary = JSONField(default=dict)
    report_styles = JSONBField(default=dict)
    report_custom = JSONBField(default=dict)
    map_styles = LazyDefaultJSONBField(default=dict)
    map_custom = LazyDefaultJSONBField(default=dict)
    asset_type = models.CharField(
        choices=ASSET_TYPES, max_length=20, default=ASSET_TYPE_SURVEY)
    parent = models.ForeignKey('Collection', related_name='assets',
                               null=True, blank=True, on_delete=models.CASCADE)
    owner = models.ForeignKey('auth.User', related_name='assets', null=True,
                              on_delete=models.CASCADE)
    editors_can_change_permissions = models.BooleanField(default=True)
    uid = KpiUidField(uid_prefix='a')
    tags = TaggableManager(manager=KpiTaggableManager)
    settings = JSONBField(default=dict)

    # _deployment_data should be accessed through the `deployment` property
    # provided by `DeployableMixin`
    _deployment_data = JSONField(default=dict)

    permissions = GenericRelation(ObjectPermission)

    objects = AssetManager()

    @property
    def kind(self):
        return 'asset'

    class Meta:
        ordering = ('-date_modified',)

        permissions = (
            # change_, add_, and delete_asset are provided automatically
            # by Django
            (PERM_VIEW_ASSET, _('Can view asset')),
            (PERM_SHARE_ASSET, _("Can change asset's sharing settings")),
            # Permissions for collected data, i.e. submissions
            (PERM_ADD_SUBMISSIONS, _('Can submit data to asset')),
            (PERM_VIEW_SUBMISSIONS, _('Can view submitted data for asset')),
            (PERM_PARTIAL_SUBMISSIONS, _('Can make partial actions on '
                                         'submitted data for asset '
                                         'for specific users')),
            (PERM_CHANGE_SUBMISSIONS, _('Can modify submitted data for asset')),
            (PERM_DELETE_SUBMISSIONS, _('Can delete submitted data for asset')),
            (PERM_SHARE_SUBMISSIONS, _("Can change sharing settings for "
                                       "asset's submitted data")),
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

    # Labels for each `asset_type` as they should be presented to users
    ASSET_TYPE_LABELS = {
        ASSET_TYPE_SURVEY: _('form'),
        ASSET_TYPE_TEMPLATE: _('template'),
        ASSET_TYPE_BLOCK: _('block'),
        ASSET_TYPE_QUESTION: _('question'),
        ASSET_TYPE_TEXT: _('text'),  # unused?
        ASSET_TYPE_EMPTY: _('empty'),  # unused?
        #ASSET_TYPE_COLLECTION: _('collection'),
    }

    # Assignable permissions that are stored in the database.
    # The labels are templates used by `get_label_for_permission()`, which you
    # should call instead of accessing this dictionary directly
    ASSIGNABLE_PERMISSIONS_WITH_LABELS = {
        PERM_VIEW_ASSET: _('View ##asset_type_label##'),
        PERM_CHANGE_ASSET: _('Edit ##asset_type_label##'),
        PERM_ADD_SUBMISSIONS: _('Add submissions'),
        PERM_VIEW_SUBMISSIONS: _('View submissions'),
        PERM_PARTIAL_SUBMISSIONS: _('View submissions only from specific users'),
        PERM_CHANGE_SUBMISSIONS: _('Edit and delete submissions'),
        PERM_VALIDATE_SUBMISSIONS: _('Validate submissions'),
    }
    ASSIGNABLE_PERMISSIONS = tuple(ASSIGNABLE_PERMISSIONS_WITH_LABELS.keys())
    # Depending on our `asset_type`, only some permissions might be applicable
    ASSIGNABLE_PERMISSIONS_BY_TYPE = {
        ASSET_TYPE_SURVEY: ASSIGNABLE_PERMISSIONS, # all of them
        ASSET_TYPE_TEMPLATE: (PERM_VIEW_ASSET, PERM_CHANGE_ASSET),
        ASSET_TYPE_BLOCK: (PERM_VIEW_ASSET, PERM_CHANGE_ASSET),
        ASSET_TYPE_QUESTION: (PERM_VIEW_ASSET, PERM_CHANGE_ASSET),
        ASSET_TYPE_TEXT: (),  # unused?
        ASSET_TYPE_EMPTY: (),  # unused?
        #ASSET_TYPE_COLLECTION: # tbd
    }

    # Calculated permissions that are neither directly assignable nor stored
    # in the database, but instead implied by assignable permissions
    CALCULATED_PERMISSIONS = (
        PERM_SHARE_ASSET,
        PERM_DELETE_ASSET,
        PERM_SHARE_SUBMISSIONS,
        PERM_DELETE_SUBMISSIONS
    )
    # Certain Collection permissions carry over to Asset
    MAPPED_PARENT_PERMISSIONS = {
        PERM_VIEW_COLLECTION: PERM_VIEW_ASSET,
        PERM_CHANGE_COLLECTION: PERM_CHANGE_ASSET
    }
    # Granting some permissions implies also granting other permissions
    IMPLIED_PERMISSIONS = {
        # Format: explicit: (implied, implied, ...)
        PERM_CHANGE_ASSET: (PERM_VIEW_ASSET,),
        PERM_ADD_SUBMISSIONS: (PERM_VIEW_ASSET,),
        PERM_VIEW_SUBMISSIONS: (PERM_VIEW_ASSET,),
        PERM_PARTIAL_SUBMISSIONS: (PERM_VIEW_ASSET,),
        PERM_CHANGE_SUBMISSIONS: (PERM_VIEW_SUBMISSIONS,),
        PERM_VALIDATE_SUBMISSIONS: (PERM_VIEW_SUBMISSIONS,)
    }

    CONTRADICTORY_PERMISSIONS = {
        PERM_PARTIAL_SUBMISSIONS: (PERM_VIEW_SUBMISSIONS, PERM_CHANGE_SUBMISSIONS,
                                      PERM_VALIDATE_SUBMISSIONS),
        PERM_VIEW_SUBMISSIONS: (PERM_PARTIAL_SUBMISSIONS,),
        PERM_CHANGE_SUBMISSIONS: (PERM_PARTIAL_SUBMISSIONS,),
        PERM_VALIDATE_SUBMISSIONS: (PERM_PARTIAL_SUBMISSIONS,)
    }

    # Some permissions must be copied to KC
    KC_PERMISSIONS_MAP = {  # keys are KC's codenames, values are KPI's
        PERM_CHANGE_SUBMISSIONS: 'change_xform',  # "Can Edit" in KC UI
        PERM_VIEW_SUBMISSIONS: 'view_xform',  # "Can View" in KC UI
        PERM_ADD_SUBMISSIONS: 'report_xform',  # "Can submit to" in KC UI
        PERM_VALIDATE_SUBMISSIONS: 'validate_xform',  # "Can Validate" in KC UI
    }
    KC_CONTENT_TYPE_KWARGS = {'app_label': 'logger', 'model': 'xform'}
    # KC records anonymous access as flags on the `XForm`
    KC_ANONYMOUS_PERMISSIONS_XFORM_FLAGS = {
        PERM_VIEW_SUBMISSIONS: {'shared': True, 'shared_data': True}
    }

    def __str__(self):
        return '{} ({})'.format(self.name, self.uid)

    def clone(self, version_uid=None):
        # not currently used, but this is how "to_clone_dict" should work
        return Asset.objects.create(**self.to_clone_dict(version_uid))

    @property
    def deployed_versions(self):
        return self.asset_versions.filter(deployed=True).order_by(
            '-date_modified')

    @property
    def content_v2(self):
        return get_content_object(self.content).export_to('2')

    @content_v2.setter
    def content_v2(self, content):
        self.content = get_content_object(content, validate=True).export_to('2')

    @property
    def content_v1(self):
        return get_content_object(self.content).export_to('1')

    @content_v1.setter
    def content_v1(self, content):
        self.content = get_content_object(content, validate=True).export_to('2')

    def from_xlsform(self, content, filename=None):
        self.content = get_content_object(content).export_to('2')
        if filename:
            self.summary = {'filename': filename}

    def get_ancestors_or_none(self):
        # ancestors are ordered from farthest to nearest
        if self.parent is not None:
            return self.parent.get_ancestors(include_self=True)
        else:
            return None

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

    def get_label_for_permission(self, permission_or_codename):
        try:
            codename = permission_or_codename.codename
            permission = permission_or_codename
        except AttributeError:
            codename = permission_or_codename
            permission = None
        try:
            label = self.ASSIGNABLE_PERMISSIONS_WITH_LABELS[codename]
        except KeyError:
            if not permission:
                # Seems expensive. Cache it?
                permission = Permission.objects.filter(
                    content_type=ContentType.objects.get_for_model(self),
                    codename=codename
                )
            label = permission.name
        label = label.replace(
            '##asset_type_label##',
            # Raises TypeError if not coerced explicitly
            str(self.ASSET_TYPE_LABELS[self.asset_type])
        )
        return label

    def get_partial_perms(self, user_id, with_filters=False):
        """
        Returns the list of permissions the user is restricted to,
        for this specific asset.
        If `with_filters` is `True`, it returns a dict of permissions (as keys) and
        the filters (as values) to apply on query to narrow down the results.

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

        :param user_obj: auth.User
        :param with_filters: boolean. Optional

        :return: list|dict|None
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
            # Avoid pulling these `JSONField`s from the database because:
            #   * they are stored as plain text, and just deserializing them
            #     to Python objects is CPU-intensive;
            #   * they are often huge;
            #   * we don't need them for list views.
            'content', 'report_styles'
        ).select_related(
            # We only need `username`, but `select_related('owner__username')`
            # actually pulled in the entire `auth_user` table under Django 1.8.
            # In Django 1.9+, "select_related() prohibits non-relational fields
            # for nested relations."
            'owner',
        ).prefetch_related(
            # We previously prefetched `permissions__content_object`, but that
            # actually pulled the entirety of each permission's linked asset
            # from the database! For now, the solution is to remove
            # `content_object` here *and* from
            # `ObjectPermissionNestedSerializer`.
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
        _content = self.content
        if len(_content) == 0:
            _content = empty_content()
        else:
            _content = get_content_object(_content).export_to('2')
        # TODO: rewrite "asset._populate_summary()" around new content structure
        # self._populate_summary()

        # infer asset_type only between question and block
        if self.asset_type in [ASSET_TYPE_QUESTION, ASSET_TYPE_BLOCK]:
            row_count = len(_content['survey'])
            if row_count == 1:
                self.asset_type = ASSET_TYPE_QUESTION
            elif row_count > 1:
                self.asset_type = ASSET_TYPE_BLOCK
            _content['settings'] = {}

        _title = _content['settings'].pop('title', None)

        if _title and self.name == '':
            self.name = _title

        _create_version = kwargs.pop('create_version', True)
        self.content = _content
        super().save(*args, **kwargs)

        if _create_version:
            self.asset_versions.create(name=self.name,
                                       version_content=_content,
                                       _deployment_data=self._deployment_data,
                                       # asset_version.deployed is set in the
                                       # DeploymentSerializer
                                       deployed=False,
                                       )

    @property
    def snapshot(self):
        return self._snapshot(regenerate=False)

    def to_clone_dict(self, version_uid=None, version=None):
        """
        Returns a dictionary of the asset based on version_uid or version.
        If `version` is specified, there are no needs to provide `version_uid` and make another request to DB.
        :param version_uid: string
        :param version: AssetVersion
        :return: dict
        """

        if not isinstance(version, AssetVersion):
            if version_uid:
                version = self.asset_versions.get(uid=version_uid)
            else:
                version = self.asset_versions.first()

        return {
            'name': version.name,
            'content': version.version_content,
            'asset_type': self.asset_type,
            'tag_string': self.tag_string,
        }

    def to_ss_structure(self):
        return flatten_content(self.content, in_place=False)

    @property
    def version__content_hash(self):
        # Avoid reading the propery `self.latest_version` more than once, since
        # it may execute a database query each time it's read
        latest_version = self.latest_version
        if latest_version:
            return latest_version.content_hash

    @property
    def version_id(self):
        # Avoid reading the propery `self.latest_version` more than once, since
        # it may execute a database query each time it's read
        latest_version = self.latest_version
        if latest_version:
            return latest_version.uid

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
        analyzer = AssetContentAnalyzer(self.content)
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
            _content = self.content_v2
            snapshot = AssetSnapshot.objects.create(asset=self,
                                                    asset_version=asset_version,
                                                    source=_content)
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


class AssetSnapshot(models.Model, XlsExportable):
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
    source = JSONField(default=dict)
    details = JSONField(default=dict)
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
        raise ValueError('use: snapshot.content_v1 or snapshot.content_v2')
        # return KoboContent(self.source).export_to('2')

    @property
    def content_v1(self):
        return get_content_object(self.source).export_to('1')

    @property
    def content_v2(self):
        return get_content_object(self.source).export_to('2')

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
        _source = get_content_object(self.source).export_to('2')
        settings = _source['settings']
        # TODO: settings default need cleanup
        settings.setdefault('identifier', '')
        settings.setdefault('title', '')
        settings.setdefault('root', 'data')

        if self.asset is None:
            _backup_id = 'non_null_id'
            _backup_title = 'non null title'
        else:
            _backup_id = self.asset.uid
            if self.asset.name:
                _backup_title = self.asset.name
            else:
                _backup_title = settings['identifier'] or _backup_id

        if settings['identifier'] in [None, '']:
            settings['identifier'] = _backup_id

        if settings['title'] in [None, '']:
            settings['title'] = _backup_title

        if settings['root'] in [None, '']:
            settings['root'] = 'data'

        self.xml, self.details = self.generate_xml_from_source(_source)
        self.source = _source
        return super().save(*args, **kwargs)

    def generate_xml_from_source(self,
                                 source,
                                 include_note=False,
                                 root_node_name=None,
                                 form_title=None,
                                 id_string=None):
        if source['schema'] != '2':
            raise ArgumentError('content must be validated with schema=2')
        settings = source['settings']
        if settings['identifier'] in [None, '']:
            raise ValueError('settings.identifier must be set')
        if 'title' not in settings:
            settings['title'] = 'my title idc2'
        if settings['title'] in [None, '']:
            raise Exception('my title idc')
            settings['title'] = 'my title idc'
            # raise ValueError('settings.title must be set')
        if settings['root'] in [None, '']:
            raise ValueError('settings.identifier must be set')
        content = KoboContent(source, validate=True).export_to('2')
        if include_note:
            _note_label = {}
            for tx in content['translations']:
                _note_label[tx['$anchor']] = include_note
            content['survey'].insert(0, {
                'type': 'note',
                '$anchor': 'xnotex',
                'name': 'xnotex',
                'label': _note_label,
            })
        if form_title is not None:
            raise ValueError('form_title should be set in '
                             'asset_content.settings[title]')
        if id_string is not None:
            raise ValueError('id_string should be set in '
                             'asset_content.settings[identifier]')
        if root_node_name is not None:
            raise ValueError('root_node_name should be set in '
                             'asset_content.settings[root]')

        warnings = []
        details = {}
        try:
            xml = FormPack(content)[0].to_xml(warnings=warnings)

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
