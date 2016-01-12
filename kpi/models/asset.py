import re
import six

from django.contrib.contenttypes.fields import GenericRelation
from django.core.exceptions import MultipleObjectsReturned
from django.db import models
from django.db import transaction
from django.dispatch import receiver
from jsonfield import JSONField
from shortuuid import ShortUUID
from taggit.managers import TaggableManager, _TaggableManager
from taggit.utils import require_instance_manager
from taggit.models import Tag
import reversion

from .object_permission import ObjectPermission, ObjectPermissionMixin
from ..utils.asset_content_analyzer import AssetContentAnalyzer
from ..utils.kobo_to_xlsform import to_xlsform_structure



ASSET_TYPES = [
    ('text', 'text'),               # uncategorized, misc

    ('question', 'question'),       # has no name
    ('block', 'block'),             # has a name, but no settings
    ('survey', 'survey'),           # has name, settings

    ('empty', 'empty'),             # useless, probably should be pruned
]

ASSET_UID_LENGTH = 22


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
        return to_xlsform_structure(self.content)

    def to_xls_io(self):
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
                            sheet.write(ri +1, ci, val)
            ss_dict = self.valid_xlsform_content()
            workbook = xlwt.Workbook()
            for sheet_name in ss_dict.keys():
                # pyxform.xls2json_backends adds "_header" items for each sheet....
                if not re.match(r".*_header$", sheet_name):
                    cur_sheet = workbook.add_sheet(sheet_name)
                    _add_contents_to_sheet(cur_sheet, ss_dict[sheet_name])
        except Exception as e:
            raise type(e)("asset.content improperly formatted for XLS export: %s" % (e.message))
        string_io = StringIO.StringIO()
        workbook.save(string_io)
        string_io.seek(0)
        return string_io

@reversion.register
class Asset(ObjectPermissionMixin, TagStringMixin, models.Model, XlsExportable):
    name = models.CharField(max_length=255, blank=True, default='')
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)
    content = JSONField(null=True)
    summary = JSONField(null=True, default={})
    asset_type = models.CharField(
        choices=ASSET_TYPES, max_length=20, default='text')
    parent = models.ForeignKey(
        'Collection', related_name='assets', null=True, blank=True)
    owner = models.ForeignKey('auth.User', related_name='assets', null=True)
    editors_can_change_permissions = models.BooleanField(default=True)
    uid = models.CharField(max_length=ASSET_UID_LENGTH, default='', blank=True)
    tags = TaggableManager(manager=KpiTaggableManager)

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

    def versions(self):
        return reversion.get_for_object(self)

    def versioned_data(self):
        return [v.field_dict for v in self.versions()]

    def to_ss_structure(self):
        return self.content

    def _pull_form_title_from_settings(self):
        if self.asset_type is not 'survey':
            return

        # settingslist
        if len(self.content['settings']) > 0:
            settings = self.content['settings'][0]
            if 'form_title' in settings:
                self.name = settings['form_title']
                del settings['form_title']
                self.content['settings'] = [settings]

    def _populate_uid(self):
        if self.uid == '':
            self.uid = self._generate_uid()

    def _populate_summary(self):
        if self.content is None:
            self.content = {}
            self.summary = {}
            return
        analyzer = AssetContentAnalyzer(**self.content)
        self.summary = analyzer.summary

    def _generate_uid(self):
        return 'a' + ShortUUID().random(ASSET_UID_LENGTH -1)

    def save(self, *args, **kwargs):
        # populate summary and uid
        if self.content is not None:
            if 'survey' in self.content:
                self._strip_empty_rows(
                    self.content['survey'], required_key='type')
            if 'choices' in self.content:
                self._strip_empty_rows(
                    self.content['choices'], required_key='name')
            if 'settings' in self.content:
                if self.asset_type is not 'survey':
                    del self.content['settings']
                else:
                    self._pull_form_title_from_settings()

        self._populate_uid()
        self._populate_summary()

        # infer asset_type only between question and block
        if self.asset_type in ['question', 'block']:
            row_count = self.summary.get('row_count')
            if row_count == 1:
                self.asset_type = 'question'
            elif row_count > 1:
                self.asset_type = 'block'

        with transaction.atomic(), reversion.create_revision():
            super(Asset, self).save(*args, **kwargs)

    def _strip_empty_rows(self, arr, required_key='type'):
        arr[:] = [row for row in arr if row.has_key(required_key)]

    def get_ancestors_or_none(self):
        # ancestors are ordered from farthest to nearest
        if self.parent is not None:
            return self.parent.get_ancestors(include_self=True)
        else:
            return None

    @property
    def version_id(self):
        return reversion.get_for_object(self).last().id

    def get_export(self, regenerate=True, version_id=False):
        if not version_id:
            version_id = reversion.get_for_object(self).last().id

        AssetSnapshot.objects.filter(asset=self, asset_version_id=version_id).delete()

        (snapshot, _created) = AssetSnapshot.objects.get_or_create(
            asset=self,
            asset_version_id=self.version_id)
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
    asset_version_id = models.IntegerField(null=True)
    date_created = models.DateTimeField(auto_now_add=True)
    uid = models.CharField(max_length=ASSET_UID_LENGTH, default='', blank=True)

    def __init__(self, *args, **kwargs):
        if (kwargs.get('asset', None) is not None and
                'asset_version_id' not in kwargs):
            asset = kwargs.get('asset')
            kwargs['asset_version_id'] = reversion.get_for_object(asset).last().pk
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

    def _populate_uid(self):
        if self.uid == '':
            self.uid = self._generate_uid()

    def _generate_uid(self):
        return 's' + ShortUUID().random(ASSET_UID_LENGTH -1)

    def get_version(self):
        if self.asset_version_id is None:
            return None
        return reversion.get_for_object(
            self.asset).get(id=self.asset_version_id)

    def _valid_source(self):
        return to_xlsform_structure(self.source)

    def save(self, *args, **kwargs):
        version = self.get_version()
        self._populate_uid()
        if self.source is None:
            self.source = version.object.to_ss_structure()
        _valid_source = self._valid_source()
        note = False
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
