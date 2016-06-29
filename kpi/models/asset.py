import re
import six
import copy
import json
from collections import OrderedDict

from django.contrib.contenttypes.fields import GenericRelation
from django.core.exceptions import MultipleObjectsReturned
from django.db import models
from django.db import transaction
from django.dispatch import receiver
from jsonfield import JSONField
from jsonbfield.fields import JSONField as JSONBField
from taggit.managers import TaggableManager, _TaggableManager
from taggit.utils import require_instance_manager
from taggit.models import Tag
from reversion import revisions as reversion

from formpack.utils.flatten_content import flatten_content
from formpack.utils.expand_content import expand_content
from .object_permission import ObjectPermission, ObjectPermissionMixin
from ..fields import KpiUidField
from ..utils.asset_content_analyzer import AssetContentAnalyzer
from ..utils.kobo_to_xlsform import to_xlsform_structure
from ..utils.random_id import random_id
from ..deployment_backends.mixin import DeployableMixin

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
        _flattened_content = copy.deepcopy(self.content)
        flatten_content(_flattened_content)
        return to_xlsform_structure(_flattened_content)

    def to_xls_io(self, extra_rows=None, extra_settings=None,
                  overwrite_settings=False):
        ''' To append rows to one or more sheets, pass `extra_rows` as a
        dictionary of dictionaries in the following format:
            `{'sheet name': {'column name': 'cell value'}`
        Extra settings may be included as a dictionary of
            `{'setting name': 'setting value'}` '''
        if extra_rows is None:
            extra_rows = {}
        import xlwt
        import StringIO
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
            # achive this isolation.
            ss_dict = copy.deepcopy(self.valid_xlsform_content())
            for extra_row_sheet_name, extra_row in extra_rows.iteritems():
                extra_row_sheet = ss_dict.get(extra_row_sheet_name, [])
                extra_row_sheet.append(extra_row)
                ss_dict[extra_row_sheet_name] = extra_row_sheet
            if extra_settings:
                for setting_name, setting_value in extra_settings.iteritems():
                    settings_sheet = ss_dict.get('settings', [{}])
                    if not len(settings_sheet):
                        settings_sheet.append({})
                    settings_row = settings_sheet[0]
                    if not overwrite_settings:
                        assert setting_name not in settings_row, (
                            u'Setting `{}` already exists, but '
                            u'`overwrite_settings` is False'.format(
                                setting_name)
                            )
                    settings_row[setting_name] = setting_value

            workbook = xlwt.Workbook()
            for sheet_name in ss_dict.keys():
                # pyxform.xls2json_backends adds "_header" items for each sheet....
                if not re.match(r".*_header$", sheet_name):
                    cur_sheet = workbook.add_sheet(sheet_name)
                    _add_contents_to_sheet(cur_sheet, ss_dict[sheet_name])
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
            'survey': {
                'name': '__version__',
                'type': 'calculate',
                'calculation': self.version_id
            }
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
    chart_styles = JSONBField(default=dict)
    asset_type = models.CharField(
        choices=ASSET_TYPES, max_length=20, default='text')
    parent = models.ForeignKey(
        'Collection', related_name='assets', null=True, blank=True)
    owner = models.ForeignKey('auth.User', related_name='assets', null=True)
    editors_can_change_permissions = models.BooleanField(default=True)
    uid = KpiUidField(uid_prefix='a')
    tags = TaggableManager(manager=KpiTaggableManager)

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

    def __init__(self, *args, **kwargs):
        r = super(Asset, self).__init__(*args, **kwargs)
        # Mind the depth
        self._initial_content_json = json.dumps(self.content)

    def _deployed_versioned_assets(self):
        asset_deployments_by_version_id = OrderedDict()
        deployed_versioned_assets = []
        # Record the current deployment, if any
        if self.has_deployment:
            asset_deployments_by_version_id[self.deployment.version] = \
                self.deployment
            # The currently deployed version may be unknown, but we still want
            # to pass its timestamp to the serializer
            if self.deployment.version == 0:
                # Temporary attributes for later use by the serializer
                self._static_version_id = 0
                self._date_deployed = self.deployment.timestamp
                deployed_versioned_assets.append(self)
        # Record all previous deployments
        _reversion_versions = reversion.get_for_object(self)
        for version in _reversion_versions:
            historical_asset = version.object_version.object
            if historical_asset.has_deployment:
                asset_deployments_by_version_id[
                    historical_asset.deployment.version
                ] = historical_asset.deployment
        # Annotate and list deployed asset versions
        _reversion_versions = reversion.get_for_object(self)
        for version in _reversion_versions.filter(
                id__in=asset_deployments_by_version_id.keys()):
            historical_asset = version.object_version.object
            # Asset.version_id returns the *most recent* version of the asset;
            # it has no way to know the version of the instance it's bound to.
            # Record a _static_version_id here for the serializer to use
            historical_asset._static_version_id = version.id
            # Make the deployment timestamp available to the serializer
            historical_asset._date_deployed = asset_deployments_by_version_id[
                version.id].timestamp
            # Store the annotated asset objects in a list for serialization
            deployed_versioned_assets.append(historical_asset)
        return deployed_versioned_assets

    def to_ss_structure(self):
        return flatten_content(copy.deepcopy(self.content))

    def _pull_form_title_from_settings(self):
        if self.asset_type != 'survey':
            return

        # settingslist
        if len(self.content['settings']) > 0:
            settings = self.content['settings'][0]
            if 'form_title' in settings:
                self.name = settings['form_title']
                del settings['form_title']
                self.content['settings'] = [settings]

    def _populate_summary(self):
        if self.content is None:
            self.content = {}
            self.summary = {}
            return
        analyzer = AssetContentAnalyzer(**self.content)
        self.summary = analyzer.summary

    def save(self, *args, **kwargs):
        # populate summary
        if self.content is not None:
            if 'survey' in self.content:
                self._strip_empty_rows(
                    self.content['survey'], required_key='type')
                self._assign_kuids(self.content['survey'])
                expand_content(self.content)
            if 'choices' in self.content:
                self._strip_empty_rows(
                    self.content['choices'], required_key='name')
                self._assign_kuids(self.content['choices'])
            if 'settings' in self.content:
                if self.asset_type != 'survey':
                    del self.content['settings']
                else:
                    self._pull_form_title_from_settings()
        self._populate_summary()

        # infer asset_type only between question and block
        if self.asset_type in ['question', 'block']:
            row_count = self.summary.get('row_count')
            if row_count == 1:
                self.asset_type = 'question'
            elif row_count > 1:
                self.asset_type = 'block'

        # TODO: prevent assets from saving duplicate versions
        super(Asset, self).save(*args, **kwargs)

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

    def _strip_empty_rows(self, arr, required_key='type'):
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
    def version_id(self):
        return self.asset_versions.first().uid

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
        return super(AssetSnapshot, self).__init__(*args, **kwargs)

    def generate_xml_from_source(self, source, **opts):
        import pyxform
        import tempfile
        summary = {}
        warnings = []
        default_name = None
        default_language = u'default'
        default_id_string = u'xform_id_string'
        # settingslist
        if 'settings' in source and len(source['settings']) > 0:
            settings = source['settings'][0]
        else:
            settings = {}

        settings.setdefault('id_string', default_id_string)

        # Delete empty `relevant` attributes from `begin group` elements.
        for i_row, row in enumerate(source['survey']):
            if (row['type'] == 'begin group') and (row.get('relevant') == ''):
                del source['survey'][i_row]['relevant']

        # form_title is now always stored in the model
        # (removed from the settings sheet until export)
        default_form_title= (hasattr(self.asset, 'name') and self.asset.name) or 'Untitled'
        settings.setdefault('form_title', default_form_title)

        if opts.get('include_note'):
            source['survey'].insert(0, {'type': 'note',
                                    'label': opts['include_note']})
        source['settings'] = [settings]
        try:
            dict_repr = pyxform.xls2json.workbook_to_json(
                source, default_name, default_language, warnings)

            for k in (u'name', u'id_string', u'sms_keyword'):
                dict_repr.setdefault(k, default_id_string)
                if not isinstance(dict_repr[k], basestring):
                    dict_repr[k]= default_id_string

            survey = pyxform.builder.create_survey_element_from_dict(dict_repr)
            with tempfile.NamedTemporaryFile(suffix='.xml') as named_tmp:
                survey.print_xform_to_file(
                    path=named_tmp.name, validate=True, warnings=warnings)
                named_tmp.seek(0)
                self.xml = named_tmp.read()
            summary.update({
                u'default_name': default_name,
                u'id_string': 'random',
                u'default_language': default_language,
                u'warnings': warnings,
            })
            summary['status'] = 'success'
        except Exception, e:
            summary.update({
                u'error_type': type(e).__name__,
                u'error': unicode(e),
                u'warnings': warnings,
            })
        self.details = summary

    def save(self, *args, **kwargs):
        if self.source is None:
            self.source = copy.deepcopy(self.asset.content)
        note = False
        _valid_source = to_xlsform_structure(self.source)
        if self.asset and self.asset.asset_type in ['question', 'block'] and \
                len(self.asset.summary['languages']) == 0:
            asset_type = self.asset.asset_type
            note = 'Note: This item is a ASSET_TYPE and ' + \
                   'must be included in a form before deploying'
            note = note.replace('ASSET_TYPE', asset_type)
        self.generate_xml_from_source(_valid_source, include_note=note)
        return super(AssetSnapshot, self).save(*args, **kwargs)


@receiver(models.signals.post_delete, sender=Asset)
def post_delete_asset(sender, instance, **kwargs):
    # Remove all permissions associated with this object
    ObjectPermission.objects.filter_for_object(instance).delete()
    # No recalculation is necessary since children will also be deleted


@receiver(models.signals.post_save, sender=Asset,
          dispatch_uid="create_asset_version")
def post_save_asset(sender, instance, **kwargs):
    instance.asset_versions.create(version_content=instance.content,
                                   name=instance.name,
                                   )
