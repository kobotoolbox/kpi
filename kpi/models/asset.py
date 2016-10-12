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
import jsonbfield.fields
from jsonfield import JSONField
from jsonbfield.fields import JSONField as JSONBField
from taggit.managers import TaggableManager, _TaggableManager
from taggit.utils import require_instance_manager

from formpack import FormPack
from formpack.utils.flatten_content import flatten_content
from kpi.utils.standardize_content import (standardize_content,
                                           standardize_content_in_place)
from kpi.utils.autoname import (autoname_fields_in_place,
                                autovalue_choices_in_place)
from formpack.utils.json_hash import json_hash
from formpack.utils.spreadsheet_content import flatten_to_spreadsheet_content
from .object_permission import ObjectPermission, ObjectPermissionMixin
from ..fields import KpiUidField
from ..utils.asset_content_analyzer import AssetContentAnalyzer
from ..utils.kobo_to_xlsform import (to_xlsform_structure,
                                     replace_with_autofields,
                                     remove_empty_expressions)
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


class XlsExportable(object):
    def valid_xlsform_content(self):
        _c = flatten_content(self.content, in_place=False)
        return to_xlsform_structure(_c, move_autonames=True)

    def to_xls_io(self, extra_rows=None, extra_settings=None,
                  overwrite_settings=False):
        ''' To append rows to one or more sheets, pass `extra_rows` as a
        dictionary of dictionaries in the following format:
            `{'sheet name': {'column name': 'cell value'}`
        Extra settings may be included as a dictionary of
            `{'setting name': 'setting value'}` '''

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
            _c = copy.deepcopy(self.content)
            if extra_settings:
                _c['settings'].update(extra_settings)
            if extra_rows:
                for sheet_name, rows in extra_rows.items():
                    if sheet_name not in _c:
                        _c[sheet_name] = []
                    _c[sheet_name] += rows

            ss_dict = flatten_to_spreadsheet_content(_c, **{
                    'remove_columns': [
                        '$autoname',
                        '$kuid',
                        '$autovalue',
                        'select_from_list_name',
                    ],
                })

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

    def to_versioned_xls_io(self):
        ''' Records the version in the `settings` sheet and as a `calculate`
        question '''
        extra_rows = {
            'survey': [
                {
                    'name': '__version__',
                    'type': 'calculate',
                    # wraps the version id in quotes: 'v12345'
                    'calculation': '\'{}\''.format(self.version_id)
                }
            ],
        }

        extra_settings = {'version': self.version_id}
        return self.to_xls_io(
            extra_rows=extra_rows,
            extra_settings=extra_settings,
            overwrite_settings=True
        )


class Asset(ObjectPermissionMixin,
            TagStringMixin,
            DeployableMixin,
            XlsExportable,
            models.Model):
    name = models.CharField(max_length=255, blank=True, default='')
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)
    content = JSONField(null=True)
    summary = JSONField(null=True, default=dict)
    report_styles = JSONBField(default=dict)
    asset_type = models.CharField(
        choices=ASSET_TYPES, max_length=20, default='text')
    parent = models.ForeignKey(
        'Collection', related_name='assets', null=True, blank=True)
    owner = models.ForeignKey('auth.User', related_name='assets', null=True)
    editors_can_change_permissions = models.BooleanField(default=True)
    uid = KpiUidField(uid_prefix='a')
    tags = TaggableManager(manager=KpiTaggableManager)
    settings = jsonbfield.fields.JSONField(default=dict)

    # _deployment_data should be accessed through the `deployment` property
    # provided by `DeployableMixin`
    _deployment_data = JSONField(default={})

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
            ('view_asset', 'Can view asset'),
            ('share_asset', "Can change this asset's sharing settings"),
        )

    # Assignable permissions that are stored in the database
    ASSIGNABLE_PERMISSIONS = ('view_asset', 'change_asset')
    # Calculated permissions that are neither directly assignable nor stored
    # in the database, but instead implied by assignable permissions
    CALCULATED_PERMISSIONS = ('share_asset', 'delete_asset')
    # Certain Collection permissions carry over to Asset
    MAPPED_PARENT_PERMISSIONS = {
        'view_collection': 'view_asset',
        'change_collection': 'change_asset'
    }

    # todo: test and implement this method
    # def restore_version(self, uid):
    #     _version_to_restore = self.asset_versions.get(uid=uid)
    #     self.content = _version_to_restore.version_content
    #     self.name = _version_to_restore.name

    def to_ss_structure(self):
        return flatten_content(self.content, in_place=False)

    def to_ordered_ss_structure(self):
        return flatten_to_spreadsheet_content(self.content, **{
                'remove_columns': [
                    'select_from_list_name',
                ]
            })

    def _populate_summary(self):
        if self.content is None:
            self.content = {}
            self.summary = {}
            return
        analyzer = AssetContentAnalyzer(**self.content)
        self.summary = analyzer.summary

    def _adjust_content_on_save(self):
        '''
        This is called on save by default if content exists.
        Can be disabled / skipped by calling with parameter:
        asset.save(adjust_content=False)
        '''
        content = standardize_content(self.content)

        # to get around the form builder's way of handling translations where
        # the interface focuses on the "null translation" and shows other ones
        # in advanced settings, we allow the builder to attach a parameter
        # which says what to name the null translation.
        if '#null_translation' in content:
            self._rename_null_translation(content,
                                          content.pop('#null_translation'))

        self._strip_empty_rows(
            content['survey'], required_key='type')
        self._assign_kuids(content['survey'])
        autoname_fields_in_place(content,
                                 destination_key='$autoname')
        remove_empty_expressions(content)
        if 'choices' in content:
            self._strip_empty_rows(
                content['choices'], required_key='list_name')
            self._assign_kuids(content['choices'])
            autovalue_choices_in_place(content,
                                       destination_key='$autovalue')

        if self.asset_type != 'survey':
            del content['settings']
        else:
            if 'form_title' in content['settings']:
                self.name = content['settings'].pop('form_title')
        self.content = content

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

    def save(self, *args, **kwargs):
        # in certain circumstances, we don't want content to
        # be altered on save. (e.g. on asset.deploy())
        if self.content is None:
            self.content = {}

        if kwargs.pop('adjust_content', True):
            self._adjust_content_on_save()

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
        Asset.objects.create(**self.to_clone_dict(version_uid))

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

    def _strip_empty_rows(self, arr, required_key='type'):
        # move this to formpack?
        arr[:] = [row for row in arr if required_key in row]

    def _assign_kuids(self, arr):
        for row in arr:
            if '$kuid' not in row:
                row['$kuid'] = random_id(9)

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

    def get_export(self, regenerate=True, version_id=False):
        if version_id:
            asset_version = self.asset_versions.get(uid=version_id)
        else:
            asset_version = self.asset_versions.first()

        (snapshot, _created) = AssetSnapshot.objects.get_or_create(
            asset=self,
            asset_version=asset_version)
        return snapshot

    def __unicode__(self):
        return u'{} ({})'.format(self.name, self.uid)


class AssetSnapshot(models.Model, XlsExportable):
    '''
    This model serves as a cache of the XML that was exported by the installed
    version of pyxform.

    TODO: come up with a policy to clear this cache out.
    DO NOT: depend on these snapshots existing for more than a day until a policy is set.
    '''
    xml = models.TextField()
    source = JSONField(null=True)
    details = JSONField(default={})
    owner = models.ForeignKey('auth.User', related_name='asset_snapshots', null=True)
    asset = models.ForeignKey(Asset, null=True)
    _reversion_version_id = models.IntegerField(null=True)
    asset_version = models.OneToOneField('AssetVersion',
                                             on_delete=models.CASCADE,
                                             null=True)
    date_created = models.DateTimeField(auto_now_add=True)
    uid = KpiUidField(uid_prefix='s')

    def __init__(self, *args, **kwargs):
        asset = kwargs.get('asset')
        asset_version = kwargs.get('asset_version')
        _no_source = not kwargs.get('source')
        if _no_source and asset and not asset_version:
            asset = kwargs.get('asset')
            kwargs['asset_version'] = asset.asset_versions.first()
        super(AssetSnapshot, self).__init__(*args, **kwargs)

    @property
    def content(self):
        return self.source

    def generate_xml_from_source(self, source, **opts):
        if opts.get('include_note') and 'survey' in source:
            _translations = source.get('translations', [])
            _label = opts.get('include_note')
            if len(_translations) > 0:
                _label = [_label for t in _translations]
            source['survey'].append({u'type': u'note',
                                     u'name': u'prepended_note',
                                     u'label': _label})
        _title = opts.get('title', 'Snapshot')
        _id_string = opts.get('id_string', 'snapshot')
        warnings = []
        self.details = {}
        try:
            self.xml = FormPack({'content': source},
                                id_string=_id_string,
                                title=_title)[0].to_xml(warnings=warnings)
            self.details.update({
                u'status': u'success',
                u'warnings': warnings,
            })
        except Exception as err:
            self.details.update({
                u'status': u'failure',
                u'error_type': type(err).__name__,
                u'error': unicode(err),
                u'warnings': warnings,
            })

    def save(self, *args, **kwargs):
        if self.source is None:
            self.source = copy.deepcopy(self.asset.content)
        standardize_content_in_place(self.source)
        if 'survey' in self.source:
            autoname_fields_in_place(self.source,
                                     destination_key='$autoname')
        if 'choices' in self.source:
            autovalue_choices_in_place(self.source,
                                       destination_key='$autovalue')
        replace_with_autofields(self.source)
        note = None
        if self.asset and self.asset.asset_type in ['question', 'block'] and \
                len(self.asset.summary['languages']) == 0:
            asset_type = self.asset.asset_type
            note = 'Note: This item is a ASSET_TYPE and ' + \
                   'must be included in a form before deploying'
            note = note.replace('ASSET_TYPE', asset_type)
        self.generate_xml_from_source(self.source, include_note=note)
        return super(AssetSnapshot, self).save(*args, **kwargs)


@receiver(models.signals.post_delete, sender=Asset)
def post_delete_asset(sender, instance, **kwargs):
    # Remove all permissions associated with this object
    ObjectPermission.objects.filter_for_object(instance).delete()
    # No recalculation is necessary since children will also be deleted
