from django.db import models
from mptt.models import MPTTModel, TreeForeignKey
from shortuuid import ShortUUID
from kpi.models.survey_asset import SurveyAsset
from taggit.managers import TaggableManager
from taggit.models import Tag
from object_permission import ObjectPermission, perm_parse
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
import re

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

    def filter_by_tag_name(self, tag_name):
        try:
            tag = Tag.objects.get(name=tag_name)
        except Tag.DoesNotExist, e:
            return self.none()
        return self.filter(tags=tag)

class Collection(MPTTModel):
    name = models.CharField(max_length=255)
    parent = TreeForeignKey('self', null=True, blank=True, related_name='children')
    owner = models.ForeignKey('auth.User', related_name='owned_collections')
    editors_can_change_permissions = models.BooleanField(default=True)
    uid = models.CharField(max_length=COLLECTION_UID_LENGTH, default='')
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)
    objects = CollectionManager()
    tags = TaggableManager()

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
        for survey_asset in self.survey_assets.all():
            survey_asset._recalculate_inherited_perms()
        # Recalculate all descendants
        for descendant in self.get_descendants():
            descendant._recalculate_inherited_perms()
            for survey_asset in descendant.survey_assets.all():
                survey_asset._recalculate_inherited_perms()

    def __unicode__(self):
        return self.name

    def _effective_perms(self, **kwargs):
        ''' Reconcile all grant and deny permissions, and return an
        authoritative set of grant permissions (i.e. deny=False) for the
        current collection. '''
        grant_perms = set(ObjectPermission.objects.filter_for_object(self,
            deny=False, **kwargs).values_list('user_id', 'permission_id'))
        deny_perms = set(ObjectPermission.objects.filter_for_object(self,
            deny=True, **kwargs).values_list('user_id', 'permission_id'))
        return grant_perms.difference(deny_perms)

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
        if self.parent is not None:
            # All our parent's effective permissions become our inherited
            # permissions
            for user_id, permission_id in self.parent._effective_perms():
                ObjectPermission.objects.create(
                    content_object=self,
                    user_id=user_id,
                    permission_id=permission_id,
                    inherited=True
                )
        # The owner gets every possible permission
        content_type = ContentType.objects.get_for_model(self)
        for perm in Permission.objects.filter(content_type=content_type):
            # Use get_or_create in case the owner already has permissions
            ObjectPermission.objects.get_or_create_for_object(
                self,
                user=self.owner,
                permission=perm,
                inherited=True
            )

    def assign_perm(self, user_obj, perm, deny=False, defer_recalc=False):
        ''' Assign user_obj the given perm on this collection. To break
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
        # Granting change implies granting view
        if codename.startswith('change_') and not deny:
            change_codename = re.sub('^change_', 'view_', codename)
            self.assign_perm(user_obj, change_codename, defer_recalc=True)
        # Denying view implies denying change
        if deny and codename.startswith('view_'):
            change_codename = re.sub('^view_', 'change_', codename)
            self.assign_perm(user_obj, change_codename,
                             deny=True, defer_recalc=True)
        # We might have been called by ourself to assign a related
        # permission. In that case, don't recalculate here.
        if defer_recalc:
            return
        # Recalculate our own child survey assets
        for survey_asset in self.survey_assets.all():
            survey_asset._recalculate_inherited_perms()
        # Recalculate all descendants and their child survey assets
        for descendant in self.get_descendants():
            descendant._recalculate_inherited_perms()
            for survey_asset in descendant.survey_assets.all():
                survey_asset._recalculate_inherited_perms()

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
        # Recalculate our own child survey assets
        for survey_asset in self.survey_assets.all():
            survey_asset._recalculate_inherited_perms()
        # Recalculate all descendants and their child survey assets
        for descendant in self.get_descendants():
            descendant._recalculate_inherited_perms()
            for survey_asset in descendant.survey_assets.all():
                survey_asset._recalculate_inherited_perms()

    def has_perm(self, user_obj, perm):
        ''' Does user_obj have perm on this collection? (True/False) '''
        app_label, codename = perm_parse(perm, self)
        return len(self._effective_perms(
            user_id=user_obj.pk,
            permission__codename=codename
        )) == 1

    def get_perms(self, user_obj):
        ''' Return a list of codenames of all effective grant permissions that
        user_obj has on this collection. '''
        user_perm_ids = self._effective_perms(user=user_obj)
        perm_ids = [x[1] for x in user_perm_ids]
        return Permission.objects.filter(pk__in=perm_ids).values_list(
            'codename', flat=True)

    def get_users_with_perms(self, attach_perms=False):
        ''' Return a QuerySet of all users with any effective grant permission
        on this collection. If attach_perms=True, then return a dict with
        users as the keys and lists of their permissions as the values. '''
        user_perm_ids = self._effective_perms()
        if attach_perms:
            user_perm_dict = {}
            for user_id, perm_id in user_perm_ids:
                perm_list = user_perm_dict.get(user_id, [])
                perm_list.append(Permission.objects.get(pk=perm_id).codename)
                user_perm_dict[user_id] = perm_list
            # Resolve user ids into actual user objects
            user_perm_dict = {User.objects.get(pk=key): value for (key, value)
                in user_perm_dict.iteritems()}
            return user_perm_dict
        else:
            # Use a set to avoid duplicate users
            user_ids = {x[0] for x in user_perm_ids}
            return User.objects.filter(pk__in=user_ids)
