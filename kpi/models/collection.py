from django.db import models
from mptt.models import MPTTModel, TreeForeignKey
from shortuuid import ShortUUID
from kpi.models.survey_asset import SurveyAsset
from object_permission import ObjectPermission, perm_parse
from django.contrib.auth.models import Permission

COLLECTION_UID_LENGTH = 22

class CollectionManager(models.Manager):
    def create(self, *args, **kwargs):
        assets = False
        if 'survey_assets' in kwargs:
            assets = kwargs['survey_assets']
            del kwargs['survey_assets']
        created = super(CollectionManager, self).create(*args, **kwargs)
        if assets:
            new_assets = []
            for asset in assets:
                asset['collection'] = created
                new_assets.append(SurveyAsset.objects.create(**asset))
            # bulk_create comes with a number of caveats
            # SurveyAsset.objects.bulk_create(new_assets)
        return created

class Collection(MPTTModel):
    name = models.CharField(max_length=255)
    parent = TreeForeignKey('self', null=True, blank=True, related_name='children')
    owner = models.ForeignKey('auth.User', related_name='owned_collections')
    editors_can_change_permissions = models.BooleanField(default=True)
    uid = models.CharField(max_length=COLLECTION_UID_LENGTH, default='')
    objects = CollectionManager()

    class Meta:
        permissions = (
            # change_collection and delete_collection are provided automatically
            # by Django
            ('view_collection', 'Can view collection'),
            ('share_collection', "Can change this collection's sharing settings"),
        )

    def _generate_uid(self):
        return 'c' + ShortUUID().random(COLLECTION_UID_LENGTH-1)

    def save(self, *args, **kwargs):
        # populate uid field if it's empty
        if self.uid == '':
            self.uid = self._generate_uid()
        # Do the heavy lifting
        super(Collection, self).save(*args, **kwargs)
        # Our parent may have changed; recalculate inherited permissions
        self._recalculate_inherited_perms()
        # Recalculate all descendants
        for descendant in self.get_descendants():
            descendant._recalculate_inherited_perms()
                    
    def __unicode__(self):
        return self.name

    def _effective_perms(self, **kwargs):
        grant_perms = set(ObjectPermission.objects.filter_for_object(self,
            deny=False, **kwargs).values_list('user_id', 'permission_id'))
        deny_perms = set(ObjectPermission.objects.filter_for_object(self,
            deny=True, **kwargs).values_list('user_id', 'permission_id'))
        return grant_perms.difference(deny_perms)

    def _recalculate_inherited_perms(self):
        # Start with a clean slate
        ObjectPermission.objects.filter_for_object(
            self,
            inherited=True
        ).delete()
        if self.parent is None:
            return
        for user_id, permission_id in self.parent._effective_perms():
            ObjectPermission.objects.create(
                content_object=self,
                user_id=user_id,
                permission_id=permission_id,
                inherited=True
            )

    def assign_perm(self, user_obj, perm, deny=False):
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
        # Recalculate all descendants
        for descendant in self.get_descendants():
            descendant._recalculate_inherited_perms()

    def remove_perm(self, user_obj, perm, deny=False):
        app_label, codename = perm_parse(perm, self)
        ObjectPermission.objects.filter_for_object(
            self,
            user=user_obj,
            permission__codename=codename,
            deny=deny,
            inherited=False
        ).delete()
        # Recalculate all descendants
        for descendant in self.get_descendants():
            descendant._recalculate_inherited_perms()

    def has_perm(self, user_obj, perm):
        app_label, codename = perm_parse(perm, self)
        return len(self._effective_perms(
            user_id=user_obj.pk,
            permission__codename=codename
        )) == 1
