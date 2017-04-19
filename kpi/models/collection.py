from itertools import chain

import haystack
from django.apps import apps
from django.contrib.contenttypes.fields import GenericRelation
from django.db import models
from django.dispatch import receiver
from mptt.models import MPTTModel, TreeForeignKey
from mptt.managers import TreeManager
from taggit.managers import TaggableManager
from taggit.models import Tag

from asset import (
    Asset,
    TaggableModelManager,
    KpiTaggableManager,
    TagStringMixin,
)
from object_permission import ObjectPermission, ObjectPermissionMixin
from ..haystack_utils import update_object_in_search_index
from ..fields import KpiUidField


class CollectionManager(TreeManager, TaggableModelManager):

    def create(self, *args, **kwargs):
        assets = False
        if 'assets' in kwargs:
            assets = kwargs['assets']
            del kwargs['assets']
        created = super(CollectionManager, self).create(*args, **kwargs)
        if assets:
            new_assets = []
            for asset in assets:
                asset['parent'] = created
                new_assets.append(Asset.objects.create(**asset))
            # bulk_create comes with a number of caveats
            # Asset.objects.bulk_create(new_assets)
        return created

    def filter_by_tag_name(self, tag_name):
        try:
            tag = Tag.objects.get(name=tag_name)
        except Tag.DoesNotExist:
            return self.none()
        return self.filter(tags=tag)


class Collection(ObjectPermissionMixin, TagStringMixin, MPTTModel):
    name = models.CharField(max_length=255)
    parent = TreeForeignKey(
        'self', null=True, blank=True, related_name='children')
    owner = models.ForeignKey('auth.User', related_name='owned_collections')
    editors_can_change_permissions = models.BooleanField(default=True)
    discoverable_when_public = models.BooleanField(default=False)
    uid = KpiUidField(uid_prefix='c')
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now=True)
    objects = CollectionManager()
    tags = TaggableManager(manager=KpiTaggableManager)
    permissions = GenericRelation(ObjectPermission)

    @property
    def kind(self):
        return self._meta.model_name

    class Meta:
        ordering = ('-date_modified',)
        permissions = (
            # change_, add_, and delete_collection are provided automatically
            # by Django
            ('view_collection', 'Can view collection'),
            ('share_collection',
             "Can change this collection's sharing settings"),
        )

    # Assignable permissions that are stored in the database
    ASSIGNABLE_PERMISSIONS = ('view_collection', 'change_collection')
    # Calculated permissions that are neither directly assignable nor stored
    # in the database, but instead implied by assignable permissions
    CALCULATED_PERMISSIONS = ('share_collection', 'delete_collection')
    # Granting some permissions implies also granting other permissions
    IMPLIED_PERMISSIONS = {
        # Format: explicit: (implied, implied, ...)
        'change_collection': ('view_collection',),
    }

    def delete_with_deferred_indexing(self):
        ''' Defer Haystack indexing, delete all child assets, then delete
        myself. Should be faster than `delete()` for large collections '''
        # Get the Haystack index for assets
        asset_index = haystack.connections['default'].get_unified_index(
            ).get_index(Asset)
        # Defer signal processing and begin deletion
        tag_pks = set()
        with apps.get_app_config('haystack').signal_processor.defer():
            for asset in self.assets.only('pk'):
                # Keep track of the tags we will need to reindex
                tag_pks.update(asset.tags.values_list('pk', flat=True))
                # Remove the child asset itself
                asset.delete()
                asset_index.remove_object(asset)
        # Update search index for affected tags
        for tag in Tag.objects.filter(pk__in=tag_pks):
            update_object_in_search_index(tag)
        # Remove this collection; signals will be processed normally
        self.delete()

    def get_ancestors_or_none(self):
        # ancestors are ordered from farthest to nearest
        ancestors = self.get_ancestors()
        if ancestors.exists():
            return ancestors
        else:
            return None

    def get_mixed_children(self):
        ''' Returns all children, both Assets and Collections '''
        return CollectionChildrenQuerySet(self)

    def __unicode__(self):
        return self.name


@receiver(models.signals.post_delete, sender=Collection)
def post_delete_collection(sender, instance, **kwargs):
    # Remove all permissions associated with this object
    ObjectPermission.objects.filter_for_object(instance).delete()
    # No recalculation is necessary since children will also be deleted


class CollectionChildrenQuerySet(object):
    ''' A pseudo-QuerySet containing mixed-model children of a collection.
    Collections are always listed before assets.  Derived from
    http://ramenlabs.com/2010/12/08/how-to-quack-like-a-queryset/.
    '''
    def __init__(self, collection):
        self.collection = collection
        self.child_collections = collection.get_children()
        self.child_assets = collection.assets.all()

    def __iter__(self):
        for row in chain(self.child_collections, self.child_assets):
            yield row

    def __repr__(self):
        data = list(self[:models.query.REPR_OUTPUT_SIZE + 1])
        if len(data) > models.query.REPR_OUTPUT_SIZE:
            data[-1] = "...(remaining elements truncated)..."
        return repr(data)

    def __getitem__(self, k):
        if not isinstance(k, (slice, int, long)):
            raise TypeError
        assert ((not isinstance(k, slice) and (k >= 0))
                or (isinstance(k, slice) and (k.start is None or k.start >= 0)
                    and (k.stop is None or k.stop >= 0))), \
                "Negative indexing is not supported."

        qs = self._clone()
        collections = qs.child_collections
        assets = qs.child_assets

        if isinstance(k, slice):
            ''' Colletions first, then Assets '''
            collections_start = 0
            assets_start = 0
            collections_count = None

            if k.step is not None:
                raise NotImplementedError(
                    'Slicing with a step is not implemented.'
                )
            if k.start is not None:
                # It's alright if the slice starts beyond the end of the
                # QuerySet; Django will just return emptiness
                collections_start = k.start
                # Counting is expensive; store the result for future use
                collections_count = collections.count()
                assets_start = max(0, k.start - collections_count)
            if k.stop is None:
                qs.child_collections = collections[collections_start:]
                qs.child_assets = assets[assets_start:]
                return qs
            else:
                # It's alright of the slice ends beyond the end of the
                # QuerySet; Django will just stop at the last object
                collections_stop = k.stop
                if collections_count is None:
                    # Only count if we didn't already
                    collections_count = collections.count()
                assets_stop = max(0, k.stop - collections_count)
                qs.child_collections = collections[
                    collections_start:collections_stop]
                qs.child_assets = assets[assets_start:assets_stop]
                return qs
        else:
            try:
                return collections[k]
            except IndexError:
                return assets[k - collections.count()]

    def count(self):
        return self.child_collections.count() + self.child_assets.count()

    def all(self):
        return self._clone()

    def filter(self, *args, **kwargs):
        return self._apply_to_both('filter', *args, **kwargs)

    def exclude(self, *args, **kwargs):
        return self._apply_to_both('exclude', *args, **kwargs)

    def select_related(self, *args, **kwargs):
        return self._apply_to_both('select_related', *args, **kwargs)

    def prefetch_related(self, *args, **kwargs):
        return self._apply_to_both('prefetch_related', *args, **kwargs)

    def only(self, *args, **kwargs):
        return self._apply_to_both('only', *args, **kwargs)

    def _apply_to_both(self, method, *args, **kwargs):
        qs = self._clone()
        qs.child_collections = getattr(qs.child_collections, method)(
            *args, **kwargs)
        qs.child_assets = getattr(qs.child_assets, method)(
            *args, **kwargs)
        return qs

    def _clone(self):
        qs = CollectionChildrenQuerySet(self.collection)
        qs.child_collections = self.child_collections._clone()
        qs.child_assets = self.child_assets._clone()
        return qs


class UserCollectionSubscription(models.Model):
    ''' Record a user's subscription to a publicly-discoverable collection,
    i.e. one that has `discoverable_when_public = True` '''
    collection = models.ForeignKey(Collection)
    user = models.ForeignKey('auth.User')
    uid = KpiUidField(uid_prefix='b')
    class Meta:
        unique_together = ('collection', 'user')
