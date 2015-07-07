import re

from django.contrib.contenttypes.fields import GenericRelation
from django.db import models
from django.db import transaction
from django.dispatch import receiver
from jsonfield import JSONField
from shortuuid import ShortUUID
from taggit.managers import TaggableManager
from taggit.models import Tag
import reversion

from .object_permission import ObjectPermission, ObjectPermissionMixin
from ..utils.asset_content_analyzer import AssetContentAnalyzer
from ..utils.kobo_to_xlsform import convert_any_kobo_features_to_xlsform_survey_structure



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


class AssetManager(TaggableModelManager):
    def get_queryset(self):
        return super(AssetManager, self).get_queryset().annotate(
            models.Count('assetdeployment')
        )
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
        return convert_any_kobo_features_to_xlsform_survey_structure(self.content)

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
    tags = TaggableManager()

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

    def _populate_uid(self):
        if self.uid == '':
            self.uid = self._generate_uid()

    def _populate_summary(self):
        if self.content is None:
            self.asset_type = 'empty'
            self.content = {}
            self.summary = {}
            return
        analyzer = AssetContentAnalyzer(**self.content)
        self.asset_type = analyzer.asset_type
        self.summary = analyzer.summary

    def _generate_uid(self):
        return 'a' + ShortUUID().random(ASSET_UID_LENGTH -1)

    def save(self, *args, **kwargs):
        # populate uid field if it's empty
        self._populate_uid()
        self._populate_summary()
        with transaction.atomic(), reversion.create_revision():
            super(Asset, self).save(*args, **kwargs)

    def get_descendants_list(self, include_self=False):
        ''' A asset never has any descendants, but provide this method
        a la django-mptt to simplify permissions code '''
        if include_self:
            return list(self)
        else:
            return list()

    def get_ancestors_or_none(self):
        # ancestors are ordered from farthest to nearest
        if self.parent is not None:
            return self.parent.get_ancestors(include_self=True)
        else:
            return None

    @property
    def version_id(self):
        return reversion.get_for_object(self).last().id

    @property
    def export(self):
        version_id = reversion.get_for_object(self).last().id
        # AssetSnapshot.objects.filter(asset=self).delete()
        (model, _) = AssetSnapshot.objects.get_or_create(
            asset=self,
            asset_version_id=self.version_id)
        return model

    def content_terms(self):
        # TODO: make prettier: strip HTML, etc.
        terms = set()
        values = self.content.values()
        while values:
            value = values.pop()
            if isinstance(value, dict):
                values.extend(value.values())
            elif isinstance(value, list):
                values.extend(value)
            else:
                terms.add(value)
        return terms

    def __unicode__(self):
        return u'{} ({})'.format(self.name, self.uid)

class AssetSnapshot(models.Model, XlsExportable):

    '''
    This model serves as a cache of the XML that was exported by the installed
    version of pyxform.

    If the database gets heavy, we will want to clear this out.
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

    def generate_xml_from_source(self, source):
        import pyxform
        import tempfile
        summary = {}
        warnings = []
        default_name = None
        default_language = u'default'
        default_id_string = u'xform_id_string'
        if 'settings' not in source:
            raise Exception("Cannot generate XML from a document with no settings")
        if 'id_string' not in source['settings'][0]:
            source['settings'][0]['id_string'] = default_id_string
        try:
            dict_repr = pyxform.xls2json.workbook_to_json(
                source, default_name, default_language, warnings)
            # TODO: Change when using this method for real deployments?
            # IDs don't matter for previews
            for k in (u'name', u'id_string', u'sms_keyword'):
                dict_repr[k] = default_id_string
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
                u'error': unicode(e),
                u'warnings': warnings,
            })
        self.summary = summary

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

    def save(self, *args, **kwargs):
        version = self.get_version()
        self._populate_uid()
        if self.source is None:
            self.source = version.object.to_ss_structure()
        self.generate_xml_from_source(self.source)
        return super(AssetSnapshot, self).save(*args, **kwargs)


@receiver(models.signals.post_delete, sender=Asset)
def post_delete_asset(sender, instance, **kwargs):
    # Remove all permissions associated with this object
    ObjectPermission.objects.filter_for_object(instance).delete()
    # No recalculation is necessary since children will also be deleted
