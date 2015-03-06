from django.db import models
from mptt.models import MPTTModel, TreeForeignKey
from shortuuid import ShortUUID
from kpi.models.survey_asset import SurveyAsset
from role_types import ROLE_TYPES, get_role_privileges

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
    users = models.ManyToManyField('auth.User', through='CollectionUser', related_name='+')
    editors_can_change_permissions = models.BooleanField(default=True)
    uid = models.CharField(max_length=COLLECTION_UID_LENGTH, default='')
    objects = CollectionManager()

    def get_user_privileges(self, user):
        ''' Starting from this collection, walk toward the root of the tree
        until a permissions record is found for the given user. Return the
        user's permissions as a tuple of (can_view, can_edit). '''
        collection = self
        while collection is not None:
            if user is collection.owner:
                # The owner has full access.
                return (True, True)
            try:
                self.collectionuser_set.get(user=user)
                return get_role_privileges(collection_user.role_type)
            except CollectionUser.DoesNotExist:
                pass
            collection = collection.parent
        return (False, False)

    def can_view(self, user):
        return self.get_user_privileges(user)[0]

    def can_edit(self, user):
        return self.get_user_privileges(user)[1]

    def can_delete(self, user):
        return user is self.owner

    def can_change_permissions(self, user):
        return user is self.owner or (
            self.can_edit(user) and self.editors_can_change_permissions)

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

    def _generate_uid(self):
        return 'c' + ShortUUID().random(COLLECTION_UID_LENGTH-1)

    def save(self, *args, **kwargs):
        # populate uid field if it's empty
        if self.uid == '':
            self.uid = self._generate_uid()
        super(Collection, self).save(*args, **kwargs)
                    
    def __unicode__(self):
        return self.name

class CollectionUser(models.Model):
    collection = models.ForeignKey(Collection)
    user = models.ForeignKey('auth.User')
    role_type = models.CharField(
        choices=ROLE_TYPES,
        max_length=20,
        default='denied'
    )
