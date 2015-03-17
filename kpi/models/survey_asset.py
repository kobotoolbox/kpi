from django.db import models
from django.db import transaction
from shortuuid import ShortUUID
from jsonfield import JSONField
import reversion
import json
import copy
from object_permission import ObjectPermission, perm_parse
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType

SURVEY_ASSET_TYPES = [
    ('text', 'text'),
    ('survey_block', 'survey_block'),
    ('choice_list', 'choice list'),
]
SURVEY_ASSET_UID_LENGTH = 22

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

    class Meta:
        ordering = ('date_created',)
        permissions = (
            # change_surveyasset and delete_surveyasset are provided
            # automatically by Django
            ('view_surveyasset', 'Can view survey asset'),
            ('share_surveyasset', "Can change this survey asset's sharing settings"),
        )

    def versions(self):
        return reversion.get_for_object(self)

    def versioned_data(self):
        return [v.field_dict for v in self.versions()]

    def _to_ss_structure(self, content_tag='survey'):
        # by default, the content is assigned to a 'sheet' with the asset_type
        # as a name
        obj = { self.asset_type: self.content }

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
        # Apply the owner's implicit permissions
        self._recalculate_inherited_perms()

    def _recalculate_inherited_perms(self):
        ''' Copy all of our parent's effective permissions to ourself,
        marking the copies as inherited permissions. The owner's rights are
        also made explicit as "inherited" permissions. '''
        # Start with a clean slate
        ObjectPermission.objects.filter_for_object(
            self,
            inherited=True
        ).delete()
        # Is there anything to inherit?
        if self.collection is None:
            return
        # All our parent's effective permissions become our inherited
        # permissions
        mangle_perm = lambda x: x.replace('_collection', '_surveyasset', 1)
        # Store translations in a dictionary here to minimize invocations of
        # the Django machinery
        translate_perm = {}
        for user_id, permission_id in self.collection._effective_perms():
            try:
                translated_id = translate_perm[permission_id]
            except KeyError:
                collection_perm = Permission.objects.get(
                    pk=permission_id)
                translated_id = Permission.objects.get(
                    content_type__app_label=collection_perm.app_label,
                    codename=mangle_perm(collection_perm.codename)
                ).pk
                translate_perm[permission_id] = translated_id
            ObjectPermission.objects.create(
                content_object=survey_asset,
                user_id=user_id,
                permission_id=translated_id,
                inherited=True
            )
        # The owner gets every possible permission
        content_type = ContentType.objects.get_for_model(self)
        for perm in Permission.objects.filter(content_type=content_type):
            # Use get_or_create in case the owner already has permissions
            ObjectPermission.objects.get_or_create(
                content_object=self,
                user=self.owner,
                permission=perm,
                inherited=True
            )

    def _effective_perms(self, **kwargs):
        ''' Reconcile all grant and deny permissions, and return an
        authoritative set of grant permissions (i.e. deny=False) for the
        current survey asset. '''
        grant_perms = set(ObjectPermission.objects.filter_for_object(self,
            deny=False, **kwargs).values_list('user_id', 'permission_id'))
        deny_perms = set(ObjectPermission.objects.filter_for_object(self,
            deny=True, **kwargs).values_list('user_id', 'permission_id'))
        return grant_perms.difference(deny_perms)

    def has_perm(self, user_obj, perm):
        ''' Does user_obj have perm on this survey asset? (True/False) '''
        app_label, codename = perm_parse(perm, self)
        return len(self._effective_perms(
            user_id=user_obj.pk,
            permission__codename=codename
        )) == 1

    def assign_perm(self, user_obj, perm, deny=False):
        ''' Assign user_obj the given perm on this survey asset. To break
        inheritance from a parent collection, use deny=True. '''
        app_label, codename = perm_parse(perm, self)
        perm_model = Permission.objects.get(
            content_type__app_label=app_label,
            codename=codename
        )
        existing_perms = ObjectPermission.objects.filter_for_object(
            self,
            user=user_obj,
        )
        if existing_perms.filter(
            inherited=False,
            permission_id=perm_model.pk,
            deny=deny,
        ):
            # The user already has this permission directly applied
            return
        # Remove any explicitly-defined contradictory grants or denials
        existing_perms.filter(user=user_obj,
            permission_id=perm_model.pk,
            deny=not deny,
            inherited=False
        ).delete()
        # Create the new permission
        ObjectPermission.objects.create(
            content_object=self,
            user=user_obj,
            permission_id=perm_model.pk,
            deny=deny,
            inherited=False
        )
        self._recalculate_inherited_perms()

    def remove_perm(self, user_obj, perm, deny=False):
        ''' Revoke perm on this collection from user_obj. '''
        app_label, codename = perm_parse(perm, self)
        ObjectPermission.objects.filter_for_object(
            self,
            user=user_obj,
            permission__codename=codename,
            deny=deny,
            inherited=False
        ).delete()
        self._recalculate_inherited_perms()
