#!/usr/bin/python
# -*- coding: utf-8 -*-
# 😬

import re
import copy
import json
import StringIO
from collections import OrderedDict

import xlwt
import six
from django.contrib.contenttypes.fields import GenericRelation
from django.core.exceptions import MultipleObjectsReturned
from django.db import models
from django.db import transaction
from django.dispatch import receiver
from django.utils.translation import ugettext_lazy as _
import jsonbfield.fields
from jsonfield import JSONField
from jsonbfield.fields import JSONField as JSONBField
from taggit.managers import TaggableManager, _TaggableManager
from taggit.utils import require_instance_manager

from formpack import FormPack
from formpack.utils.flatten_content import flatten_content
from formpack.utils.json_hash import json_hash
from formpack.utils.spreadsheet_content import flatten_to_spreadsheet_content
from kpi.utils.standardize_content import (standardize_content,
                                           needs_standardization,
                                           standardize_content_in_place)
from kpi.utils.autoname import (autoname_fields_in_place,
                                autovalue_choices_in_place)
from .object_permission import ObjectPermission, ObjectPermissionMixin
from ..fields import KpiUidField
from ..utils.asset_content_analyzer import AssetContentAnalyzer
from ..utils.sluggify import sluggify_label
from ..utils.kobo_to_xlsform import (to_xlsform_structure,
                                     expand_rank_and_score_in_place,
                                     replace_with_autofields,
                                     remove_empty_expressions_in_place)
from ..utils.asset_translation_utils import (
        compare_translations,
        # TRANSLATIONS_EQUAL,
        TRANSLATIONS_OUT_OF_ORDER,
        TRANSLATION_RENAMED,
        TRANSLATION_DELETED,
        TRANSLATION_ADDED,
        TRANSLATION_CHANGE_UNSUPPORTED,
        TRANSLATIONS_MULTIPLE_CHANGES,
    )
from ..utils.random_id import random_id
from ..deployment_backends.mixin import DeployableMixin
from kobo.apps.reports.constants import (SPECIFIC_REPORTS_KEY,
                                         DEFAULT_REPORTS_KEY)


ASSET_TYPES = [
    ('text', 'text'),               # uncategorized, misc

    ('question', 'question'),       # has no name
    ('block', 'block'),             # has a name, but no settings
    ('survey', 'survey'),           # has name, settings

    ('empty', 'empty'),             # useless, probably should be pruned
]


# TODO: Would prefer this to be a mixin that didn't derive from `Manager`.
class TaggableModelManager(models.Manager):

    def create(self, *args, **kwargs):
        tag_string= kwargs.pop('tag_string', None)
        created= super(TaggableModelManager, self).create(*args, **kwargs)
        if tag_string:
            created.tag_string= tag_string
        return created


class KpiTaggableManager(_TaggableManager):
    @require_instance_manager
    def add(self, *tags, **kwargs):
        ''' A wrapper that replaces spaces in tag names with dashes and also
        strips leading and trailng whitespace. Behavior should match the
        TagsInput transform function in app.es6. '''
        tags_out = []
        for t in tags:
            # Modify strings only; the superclass' add() method will then
            # create Tags or use existing ones as appropriate.  We do not fix
            # existing Tag objects, which could also be passed into this
            # method, because a fixed name could collide with the name of
            # another Tag object already in the database.
            if isinstance(t, six.string_types):
                t = t.strip().replace(' ', '-')
            tags_out.append(t)
        super(KpiTaggableManager, self).add(*tags_out, **kwargs)


class AssetManager(TaggableModelManager):
    def filter_by_tag_name(self, tag_name):
        return self.filter(tags__name=tag_name)


# TODO: Merge this functionality into the eventual common base class of `Asset`
# and `Collection`.
class TagStringMixin:

    @property
    def tag_string(self):
        return ','.join(self.tags.values_list('name', flat=True))

    @tag_string.setter
    def tag_string(self, value):
        intended_tags = value.split(',')
        self.tags.set(*intended_tags)

FLATTEN_OPTS = {
    'remove_columns': {
        'survey': [
            '$autoname',
            '$kuid',
            '$prev',
            'select_from_list_name',
            '_or_other',
        ],
        'choices': [
            '$autovalue',
            '$kuid',
        ]
    },
    'remove_sheets': [
        'schema',
    ],
}


class FormpackXLSFormUtils(object):
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
        _settings = content.get('settings', {})
        if isinstance(_settings, list):
            if len(_settings) > 0:
                _settings = _settings[0]
            else:
                _settings = {}
        if not isinstance(_settings, dict):
            _settings = {}
        content['settings'] = _settings

    def _append(self, content, **sheet_data):
        settings = sheet_data.pop('settings', None)
        if settings:
            self._ensure_settings(content)
            content['settings'].update(settings)
        for (sht, rows) in sheet_data.items():
            if sht in content:
                content[sht] += rows

    def _xlsform_structure(self, content, ordered=True):
        if ordered:
            if not isinstance(content, OrderedDict):
                raise TypeError('content must be an ordered dict if '
                                'ordered=True')
            flatten_to_spreadsheet_content(content, in_place=True,
                                           **FLATTEN_OPTS)
        else:
            flatten_content(content, in_place=True, **FLATTEN_OPTS)

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
            if '$kuid' in row:
                del row['$kuid']

    def _remove_empty_expressions(self, content):
        remove_empty_expressions_in_place(content)

    def _adjust_active_translation(self, content):
        # to get around the form builder's way of handling translations where
        # the interface focuses on the "null translation" and shows other ones
        # in advanced settings, we allow the builder to attach a parameter
        # which says what to name the null translation.
        _null_translation_as = content.pop('#active_translation_name', None)
        if _null_translation_as:
            self._rename_translation(content, None, _null_translation_as)

    def _strip_empty_rows(self, content, vals=None):
        if vals is None:
            vals = {
                u'survey': u'type',
                u'choices': u'list_name',
            }
        for (sheet_name, required_key) in vals.iteritems():
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
        _translations = content.get('translations')
        _translated = content.get('translated', [])
        if is_new and (translation_name in _translations):
            raise ValueError('cannot add existing translation')
        elif (not is_new) and (translation_name not in _translations):
            raise ValueError('translation cannot be found')
        _tindex = -1 if is_new else _translations.index(translation_name)
        if is_new or (_tindex > 0):
            for row in content.get('survey', []):
                for col in _translated:
                    if is_new:
                        val = '{}'.format(row[col][0])
                    else:
                        val = row[col].pop(_tindex)
                    row[col].insert(0, val)
            for row in content.get('choices', []):
                for col in _translated:
                    if is_new:
                        val = '{}'.format(row[col][0])
                    else:
                        val = row[col].pop(_tindex)
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


class XlsExportable(object):
    def flattened_content_copy(self):
        _c = self.standardized_content_copy()
        flatten_content(_c, in_place=True)
        return to_xlsform_structure(_c, move_autonames=True)

    def valid_xlsform_content(self):
        return self.flattened_content_copy()

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
        content = OrderedDict(content)
        self._xlsform_structure(content, ordered=True)
        return content

    def to_xls_io(self, versioned=False, **kwargs):
        ''' To append rows to one or more sheets, pass `append` as a
        dictionary of dictionaries in the following format:
            `{'sheet name': [{'column name': 'cell value'}]}`
        Extra settings may be included as a dictionary in the same
        parameter.
            `{'settings': {'setting name': 'setting value'}}` '''
        if versioned:
            kwargs['append'
                   ] = {'survey': [
                        {'name': '__version__',
                         'calculation': '\'{}\''.format(self.version_id),
                         'type': 'calculate'}
                        ],
                        'settings': {'version': self.version_id}}
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

            workbook = xlwt.Workbook()
            for (sheet_name, contents) in ss_dict.iteritems():
                cur_sheet = workbook.add_sheet(sheet_name)
                _add_contents_to_sheet(cur_sheet, contents)
        except Exception as e:
            raise Exception("asset.content improperly formatted for XLS "
                            "export: %s" % repr(e))
        string_io = StringIO.StringIO()
        workbook.save(string_io)
        string_io.seek(0)
        return string_io


class Asset(ObjectPermissionMixin,
            TagStringMixin,
            DeployableMixin,
            XlsExportable,
            FormpackXLSFormUtils,
            models.Model):
    name = models.CharField(max_length=255, blank=True, default='')
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)
    content = JSONField(null=True)
    summary = JSONField(null=True, default=dict)
    report_styles = JSONBField(default=dict)
    asset_type = models.CharField(
        choices=ASSET_TYPES, max_length=20, default='survey')
    parent = models.ForeignKey(
        'Collection', related_name='assets', null=True, blank=True)
    owner = models.ForeignKey('auth.User', related_name='assets', null=True)
    editors_can_change_permissions = models.BooleanField(default=True)
    uid = KpiUidField(uid_prefix='a')
    tags = TaggableManager(manager=KpiTaggableManager)
    settings = jsonbfield.fields.JSONField(default=dict)

    # _deployment_data should be accessed through the `deployment` property
    # provided by `DeployableMixin`
    _deployment_data = JSONField(default=dict)

    permissions = GenericRelation(ObjectPermission)

    objects = AssetManager()

    @property
    def kind(self):
        return self._meta.model_name

    class Meta:
        ordering = ('-date_modified',)

        permissions = (
            # change_, add_, and delete_asset are provided automatically
            # by Django
            ('view_asset', _('Can view asset')),
            ('share_asset', _("Can change asset's sharing settings")),
            # Permissions for collected data, i.e. submissions
            ('add_submissions', _('Can submit data to asset')),
            ('view_submissions', _('Can view submitted data for asset')),
            ('change_submissions', _('Can modify submitted data for asset')),
            ('delete_submissions', _('Can delete submitted data for asset')),
            ('share_submissions', _("Can change sharing settings for "
                                    "asset's submitted data"))
        )

    # Assignable permissions that are stored in the database
    ASSIGNABLE_PERMISSIONS = (
        'view_asset',
        'change_asset',
        'add_submissions',
        'view_submissions',
        'change_submissions'
    )
    # Calculated permissions that are neither directly assignable nor stored
    # in the database, but instead implied by assignable permissions
    CALCULATED_PERMISSIONS = ('share_asset', 'delete_asset')
    # Certain Collection permissions carry over to Asset
    MAPPED_PARENT_PERMISSIONS = {
        'view_collection': 'view_asset',
        'change_collection': 'change_asset'
    }
    # Granting some permissions implies also granting other permissions
    IMPLIED_PERMISSIONS = {
        # Format: explicit: (implied, implied, ...)
        'change_asset': ('view_asset',),
        'add_submissions': ('view_asset',),
        'view_submissions': ('view_asset',),
        'change_submissions': ('view_submissions',)
    }

    # todo: test and implement this method
    # def restore_version(self, uid):
    #     _version_to_restore = self.asset_versions.get(uid=uid)
    #     self.content = _version_to_restore.version_content
    #     self.name = _version_to_restore.name

    def to_ss_structure(self):
        return flatten_content(self.content, in_place=False)

    def _populate_summary(self):
        if self.content is None:
            self.content = {}
            self.summary = {}
            return
        analyzer = AssetContentAnalyzer(**self.content)
        self.summary = analyzer.summary

    def adjust_content_on_save(self):
        '''
        This is called on save by default if content exists.
        Can be disabled / skipped by calling with parameter:
        asset.save(adjust_content=False)
        '''
        self._standardize(self.content)

        self._adjust_active_translation(self.content)
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
        if self.asset_type != 'survey':
            # instead of deleting the settings, simply clear them out
            self.content['settings'] = {}

        if _title is not None:
            self.name = _title

    def save(self, *args, **kwargs):
        if self.content is None:
            self.content = {}

        # in certain circumstances, we don't want content to
        # be altered on save. (e.g. on asset.deploy())
        if kwargs.pop('adjust_content', True):
            self.adjust_content_on_save()

        # populate summary
        self._populate_summary()

        # infer asset_type only between question and block
        if self.asset_type in ['question', 'block']:
            row_count = self.summary.get('row_count')
            if row_count == 1:
                self.asset_type = 'question'
            elif row_count > 1:
                self.asset_type = 'block'

        self._populate_report_styles()

        _create_version = kwargs.pop('create_version', True)
        super(Asset, self).save(*args, **kwargs)

        if _create_version:
            self.asset_versions.create(name=self.name,
                                       version_content=self.content,
                                       _deployment_data=self._deployment_data,
                                       # asset_version.deployed is set in the
                                       # DeploymentSerializer
                                       deployed=False,
                                       )

    def rename_translation(self, _from, _to):
        if not self._has_translations(self.content, 2):
            raise ValueError('no translations available')
        self._rename_translation(self.content, _from, _to)

    def to_clone_dict(self, version_uid=None):
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

    def clone(self, version_uid=None):
        # not currently used, but this is how "to_clone_dict" should work
        return Asset.objects.create(**self.to_clone_dict(version_uid))

    def revert_to_version(self, version_uid):
        av = self.asset_versions.get(uid=version_uid)
        self.content = av.version_content
        self.save()

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

    def get_ancestors_or_none(self):
        # ancestors are ordered from farthest to nearest
        if self.parent is not None:
            return self.parent.get_ancestors(include_self=True)
        else:
            return None

    @property
    def latest_version(self):
        return self.asset_versions.order_by('-date_modified').first()

    @property
    def deployed_versions(self):
        return self.asset_versions.filter(deployed=True).order_by(
                                          '-date_modified')

    @property
    def latest_deployed_version(self):
        return self.deployed_versions.first()

    @property
    def version_id(self):
        latest_version = self.latest_version
        if latest_version:
            return latest_version.uid

    @property
    def snapshot(self):
        return self._snapshot(regenerate=False)

    @transaction.atomic
    def _snapshot(self, regenerate=True):
        asset_version = self.asset_versions.first()

        _note = None
        if self.asset_type in ['question', 'block']:
            _note = ('Note: This item is a {} and must be included in '
                     'a form before deploying'.format(self.asset_type))

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

    def __unicode__(self):
        return u'{} ({})'.format(self.name, self.uid)


class AssetSnapshot(models.Model, XlsExportable, FormpackXLSFormUtils):
    '''
    This model serves as a cache of the XML that was exported by the installed
    version of pyxform.

    TODO: come up with a policy to clear this cache out.
    DO NOT: depend on these snapshots existing for more than a day until a policy is set.
    '''
    xml = models.TextField()
    source = JSONField(null=True)
    details = JSONField(default=dict)
    owner = models.ForeignKey('auth.User', related_name='asset_snapshots', null=True)
    asset = models.ForeignKey(Asset, null=True)
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
            if self.asset_version is None:
                self.asset_version = self.asset.latest_version
            if self.source is None:
                self.source = self.asset_version.version_content
            if self.owner is None:
                self.owner = self.asset.owner
        _note = self.details.pop('note', None)
        _source = copy.deepcopy(self.source)
        if _source is None:
            _source = {}
        self._standardize(_source)
        self._adjust_active_translation(_source)
        self._strip_empty_rows(_source)
        self._autoname(_source)
        self._remove_empty_expressions(_source)
        _settings = _source.get('settings', {})
        form_title = _settings.get('form_title')
        id_string = _settings.get('id_string')

        (self.xml, self.details) = \
            self.generate_xml_from_source(_source,
                                          include_note=_note,
                                          root_node_name='data',
                                          form_title=form_title,
                                          id_string=id_string)
        self.source = _source
        return super(AssetSnapshot, self).save(*args, **kwargs)

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
            source['survey'].append({u'type': u'note',
                                     u'name': u'prepended_note',
                                     u'label': _label})

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
                u'status': u'success',
                u'warnings': warnings,
            })
        except Exception as err:
            xml = ''
            details.update({
                u'status': u'failure',
                u'error_type': type(err).__name__,
                u'error': unicode(err),
                u'warnings': warnings,
            })
        return (xml, details)



@receiver(models.signals.post_delete, sender=Asset)
def post_delete_asset(sender, instance, **kwargs):
    # Remove all permissions associated with this object
    ObjectPermission.objects.filter_for_object(instance).delete()
    # No recalculation is necessary since children will also be deleted
