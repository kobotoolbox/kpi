from django.db import models
from mptt.models import MPTTModel, TreeForeignKey
from shortuuid import ShortUUID
from kpi.models.survey_asset import SurveyAsset
from taggit.managers import TaggableManager
from taggit.models import Tag
from object_permission import ObjectPermission
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
    objects = CollectionManager()
    tags = TaggableManager()

    class Meta:
        permissions = (
            # change_collection and delete_collection are provided automatically
            # by Django
            ('view_collection', 'Can view collection'),
            ('share_collection', "Can change this collection's sharing settings"),
            ('deny_view_collection', 'Blocks view privilege inherited from '
                'ancestor'),
            ('deny_change_collection', 'Blocks change privilege inherited from '
                'ancestor'),
        )

    def _generate_uid(self):
        return 'c' + ShortUUID().random(COLLECTION_UID_LENGTH-1)

    def save(self, *args, **kwargs):
        # populate uid field if it's empty
        if self.uid == '':
            self.uid = self._generate_uid()
        super(Collection, self).save(*args, **kwargs)
                    
    def __unicode__(self):
        return self.name

    def has_perm(self, user_obj, perm):
        ''' Starting from this collection, walk toward the root of the tree
        until a permissions record is found for the given user. '''
        collection = self
        split_perm = perm.split('.')
        try:
            app_label = split_perm[0]
            codename = split_perm[1]
        except IndexError:
            # django.contrib.auth.backends.ModelBackend doesn't raise an
            # exception in this case. If user doesn't have perm because perm is
            # formatted invalidly, so be it.
            return False
        while collection is not None:
            if user_obj.pk is collection.owner.pk:
                # The owner has full access, so long as perm is a permission
                # that applies to this object.
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
                pass
            collection = collection.parent
        # We got to the root of the tree without finding any matching
        # permissions.
        return False

    """ Adios.

    def get_all_user_privileges(self):
        ''' Return all inherited and directly-assigned privileges in the format
        {user_id: (can_view, can_edit)}. '''
        user_privileges = {}
        collections = list(self.get_ancestors().only('owner'))
        collections.append(self)
        for collection in collections:
            for col_user in collection.collectionuser_set.all():
                # More distant permissions are simply overwritten with
                # nearer ones.
                user_privileges[col_user.user_id] = get_role_privileges(
                    col_user.role_type)
            # The owner has full access.
            user_privileges[collection.owner_id] = (True, True)
        return user_privileges

    """
