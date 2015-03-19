from django.db import models
from django.db import transaction
from shortuuid import ShortUUID
from jsonfield import JSONField
from taggit.managers import TaggableManager
from taggit.models import Tag
import reversion
import json
import copy
from object_permission import ObjectPermission
from django.contrib.auth.models import Permission

SURVEY_ASSET_TYPES = [
    ('text', 'text'),
    ('survey_block', 'survey_block'),
    ('choice_list', 'choice list'),
]
SURVEY_ASSET_UID_LENGTH = 22

class SurveyAssetManager(models.Manager):
    def filter_by_tag_name(self, tag_name):
        try:
            tag = Tag.objects.get(name=tag_name)
        except Tag.DoesNotExist, e:
            return self.none()
        return self.filter(tags=tag)


@reversion.register
class SurveyAsset(models.Model):
    name = models.CharField(max_length=255, blank=True, default='')
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)
    content = JSONField(null=True)
    additional_sheets = JSONField(null=True)
    settings = JSONField(null=True)
    asset_type = models.CharField(choices=SURVEY_ASSET_TYPES, max_length=20, default='text')
    collection = models.ForeignKey('Collection', related_name='survey_assets', null=True)
    owner = models.ForeignKey('auth.User', related_name='survey_assets', null=True)
    editors_can_change_permissions = models.BooleanField(default=True)
    uid = models.CharField(max_length=SURVEY_ASSET_UID_LENGTH, default='')
    tags = TaggableManager()

    objects = SurveyAssetManager()

    class Meta:
        ordering = ('date_created',)
        permissions = (
            # change_surveyasset and delete_surveyasset are provided
            # automatically by Django
            ('view_surveyasset', 'Can view survey asset'),
            ('share_surveyasset', "Can change this survey asset's sharing settings"),
            ('deny_view_surveyasset', 'Blocks view privilege inherited from '
                'ancestor'),
            ('deny_change_surveyasset', 'Blocks change privilege inherited from '
                'ancestor'),
        )

    def versions(self):
        return reversion.get_for_object(self)

    def versioned_data(self):
        return [v.field_dict for v in self.versions()]

    def _to_ss_structure(self, content_tag=None):
        # by default, the content is assigned to a 'sheet' with the asset_type
        # as a name
        if not content_tag:
            content_tag = self.asset_type
        obj = { content_tag: self.content }

        if self.additional_sheets:
            obj.update(copy.copy(self.additional_sheets))

        if self.settings:
            obj.update({'settings': [copy.copy(self.settings)]})

        return obj

    def to_ss_structure(self, content_tag='survey', strip_kuids=False):
        obj = {}
        rows = []
        for row in self.content:
            _r = copy.copy(row)
            if strip_kuids and 'kuid' in _r:
                del _r['kuid']
            rows.append(_r)
        obj[content_tag] = rows
        return obj

    def _populate_uid(self):
        if self.uid == '':
            self.uid = self._generate_uid()

    def _generate_uid(self):
        return 'a' + ShortUUID().random(SURVEY_ASSET_UID_LENGTH-1)

    def save(self, *args, **kwargs):
        # populate uid field if it's empty
        self._populate_uid()
        with transaction.atomic(), reversion.create_revision():
            super(SurveyAsset, self).save(*args, **kwargs)

    def has_perm(self, user_obj, perm):
        ''' Determine of user_obj has perm on this survey asset. Considers both
        directly applied permissions as well as those inherited from a 
        collection. '''
        split_perm = perm.split('.')
        try:
            app_label = split_perm[0]
            codename = split_perm[1]
        except IndexError:
            # django.contrib.auth.backends.ModelBackend doesn't raise an
            # exception in this case. If user doesn't have perm because perm is
            # formatted invalidly, so be it.
            return False
        if user_obj.pk is self.owner.pk:
            # The owner has full access, so long as perm is a permission that
            # applies to this object.
            return Permission.objects.filter(
                content_type__app_label=app_label,
                codename=codename
            ).exists()
        try:
            ObjectPermission.objects.get_for_object(
                self,
                user=user_obj,
                permission__content_type__app_label=app_label,
                permission__codename=codename
            )
            # If we got this far, we found a matching permissions record!
            return True
        except ObjectPermission.DoesNotExist:
            # No directly applied permissions match; check the collection
            pass
        if self.collection is not None:
            # Rewrite the perm string so it references collection instead of
            # surveyasset
            mangled_perm = perm.replace('_surveyasset', '_collection', 1)
            return self.collection.has_perm(user_obj, mangled_perm)
        return False

    @property
    def export(self):
        version_id = reversion.get_for_object(self).last().id
        # SurveyAssetExport.objects.filter(survey_asset=self).delete()
        (model, created,) = SurveyAssetExport.objects.get_or_create(survey_asset=self,
                                survey_asset_version_id=version_id)
        return model

    """ The wet head is dead.

    def get_all_user_privileges(self):
        ''' Return all inherited and directly-assigned privileges in the format
        {user_id: (can_view, can_edit)}. '''
        user_privileges = {}
        if self.collection is not None:
            user_privileges = self.collection.get_all_user_privileges()
        # Directly applied permissions override those inherited from a
        # collection.
        for sa_user in self.surveyassetuser_set.all():
            user_privileges[sa_user.id] = get_role_privileges(sa_user.role_type)
        # The owner has full access.
        user_privileges[self.owner_id] = (True, True)
        return user_privileges

    """

class SurveyAssetExport(models.Model):
    '''
    This model serves as a cache of the XML that was exported by the installed
    version of pyxform.

    If the database gets heavy, we will want to clear this out.
    '''
    xml = models.TextField()
    source = JSONField(default='{}')
    details = JSONField(default='{}')
    survey_asset = models.ForeignKey(SurveyAsset)
    survey_asset_version_id = models.IntegerField()
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
        version = reversion.get_for_object(self.survey_asset).get(id=self.survey_asset_version_id)
        survey_asset = version.object
        self.source = survey_asset._to_ss_structure(content_tag='survey')
        self.generate_xml_from_source()
        return super(SurveyAssetExport, self).save(*args, **kwargs)
