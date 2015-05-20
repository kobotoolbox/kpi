from django.db import models
from django.contrib.contenttypes.fields import GenericRelation
from mptt.models import MPTTModel, TreeForeignKey
from shortuuid import ShortUUID
from kpi.models.survey_asset import SurveyAsset
from taggit.managers import TaggableManager
from taggit.models import Tag
from object_permission import ObjectPermission, ObjectPermissionMixin
from django.dispatch import receiver

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
                asset['parent'] = created
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

class Collection(ObjectPermissionMixin, MPTTModel):
    name = models.CharField(max_length=255)
    parent = TreeForeignKey('self', null=True, blank=True, related_name='children')
    owner = models.ForeignKey('auth.User', related_name='owned_collections')
    editors_can_change_permissions = models.BooleanField(default=True)
    uid = models.CharField(max_length=COLLECTION_UID_LENGTH, default='')
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)
    objects = CollectionManager()
    tags = TaggableManager()
    permissions = GenericRelation(ObjectPermission)

    @property
    def kind(self):
        return self._meta.model_name

    class Meta:
        permissions = (
            # change_, add_, and delete_collection are provided automatically
            # by Django
            ('view_collection', 'Can view collection'),
            ('share_collection', "Can change this collection's sharing settings"),
        )

    # Assignable permissions that are stored in the database
    ASSIGNABLE_PERMISSIONS = ('view_collection', 'change_collection')
    # Calculated permissions that are neither directly assignable nor stored
    # in the database, but instead implied by assignable permissions
    CALCULATED_PERMISSIONS = ('share_collection', 'delete_collection')

    def _generate_uid(self):
        return 'c' + ShortUUID().random(COLLECTION_UID_LENGTH-1)

    def save(self, *args, **kwargs):
        # populate uid field if it's empty
        if self.uid == '':
            self.uid = self._generate_uid()
        super(Collection, self).save(*args, **kwargs)

    def get_descendants_list(self, include_self=False):
        ''' Similar to django-mptt's get_descendants, but returns a list
        instead of a QuerySet since our descendants are both SurveyAssets and
        Collections '''
        mixed_descendants = list()
        if not include_self:
            # Gather our own child survey assets, since we won't be included
            # in the main loop
            mixed_descendants.extend(list(self.survey_assets.all()))
        for descendant in self.get_descendants(include_self):
            # Append each of our descendant collections
            mixed_descendants.append(descendant)
            for survey_asset in descendant.survey_assets.all():
                # Append each descendant collection's child survey assets
                mixed_descendants.append(survey_asset)
        return mixed_descendants

    def __unicode__(self):
        return self.name

@receiver(models.signals.post_delete, sender=Collection)
def post_delete_collection(sender, instance, **kwargs):
    # Remove all permissions associated with this object
    ObjectPermission.objects.filter_for_object(instance).delete()
    # No recalculation is necessary since children will also be deleted
