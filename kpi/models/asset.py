from django.db import models
from django.db import transaction
from django.contrib.contenttypes.fields import GenericRelation
from shortuuid import ShortUUID
from jsonfield import JSONField
from taggit.managers import TaggableManager
from taggit.models import Tag
import re
import json
import reversion
from object_permission import ObjectPermission, ObjectPermissionMixin
from django.dispatch import receiver

ASSET_TYPES = [
    ('text', 'text'),
    ('survey_block', 'survey_block'),
    ('choice_list', 'choice list'),
]
ASSET_UID_LENGTH = 22

class AssetManager(models.Manager):
    def filter_by_tag_name(self, tag_name):
        try:
            tag = Tag.objects.get(name=tag_name)
        except Tag.DoesNotExist, e:
            return self.none()
        return self.filter(tags=tag)


@reversion.register
class Asset(ObjectPermissionMixin, models.Model):
    name = models.CharField(max_length=255, blank=True, default='')
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)
    content = JSONField(null=True)
    asset_type = models.CharField(choices=ASSET_TYPES, max_length=20, default='text')
    parent = models.ForeignKey('Collection', related_name='assets', null=True)
    owner = models.ForeignKey('auth.User', related_name='assets', null=True)
    editors_can_change_permissions = models.BooleanField(default=True)
    uid = models.CharField(max_length=ASSET_UID_LENGTH, default='')
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

    def _generate_uid(self):
        return 'a' + ShortUUID().random(ASSET_UID_LENGTH-1)

    def save(self, *args, **kwargs):
        # populate uid field if it's empty
        self._populate_uid()
        with transaction.atomic(), reversion.create_revision():
            super(Asset, self).save(*args, **kwargs)

    def get_descendants_list(self, include_self=False):
        ''' A asset never has any descendants, but provide this method
        a la django-mptt to simplify permissions code '''
        if include_self:
            return list(self)
        else:
            return list()

    def to_xls_io(self):
        import xlwt
        import StringIO
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
                        sheet.write(ri+1, ci, val)
        ss_dict = self.content
        workbook = xlwt.Workbook()
        for sheet_name in ss_dict.keys():
            # pyxform.xls2json_backends adds "_header" items for each sheet.....
            if not re.match(r".*_header$", sheet_name):
                cur_sheet = workbook.add_sheet(sheet_name)
                _add_contents_to_sheet(cur_sheet, ss_dict[sheet_name])
        string_io = StringIO.StringIO()
        workbook.save(string_io)
        string_io.seek(0)
        return string_io

    @property
    def export(self):
        version_id = reversion.get_for_object(self).last().id
        # AssetExport.objects.filter(asset=self).delete()
        (model, created,) = AssetExport.objects.get_or_create(asset=self,
                                asset_version_id=version_id)
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

class AssetExport(models.Model):
    '''
    This model serves as a cache of the XML that was exported by the installed
    version of pyxform.

    If the database gets heavy, we will want to clear this out.
    '''
    xml = models.TextField()
    source = JSONField(default='{}')
    details = JSONField(default='{}')
    asset = models.ForeignKey(Asset)
    asset_version_id = models.IntegerField()
    date_created = models.DateTimeField(auto_now_add=True)

    def generate_xml_from_source(self):
        import pyxform
        import tempfile
        summary = {}
        warnings = []
        default_name = None
        default_language = u'default'
        try:
            dict_repr = pyxform.xls2json.workbook_to_json(self.source, default_name, default_language, warnings)
            dict_repr[u'name'] = dict_repr[u'id_string']
            survey = pyxform.builder.create_survey_element_from_dict(dict_repr)
            with tempfile.NamedTemporaryFile(suffix='.xml') as named_tmp:
                survey.print_xform_to_file(path=named_tmp.name, validate=True, warnings=warnings)
                named_tmp.seek(0)
                self.xml = named_tmp.read()
            summary.update({
                u'default_name': default_name,
                u'default_language': default_language,
                u'warnings': warnings,
                })
            summary['status'] = 'success'
        except Exception, e:
            summary.update({
                u'error': unicode(e),
                u'warnings': warnings,
            })

    def save(self, *args, **kwargs):
        version = reversion.get_for_object(self.asset).get(id=self.asset_version_id)
        asset = version.object
        self.source = asset.to_ss_structure()
        self.generate_xml_from_source()
        return super(AssetExport, self).save(*args, **kwargs)

@receiver(models.signals.post_delete, sender=Asset)
def post_delete_asset(sender, instance, **kwargs):
    # Remove all permissions associated with this object
    ObjectPermission.objects.filter_for_object(instance).delete()
    # No recalculation is necessary since children will also be deleted
