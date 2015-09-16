import django.db.models
from django.dispatch import receiver
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.conf import settings
from taggit.models import Tag, TaggedItem
from haystack import connections
from haystack.exceptions import NotHandled
from models import Collection, Asset, TagUid
from .model_utils import grant_default_model_level_perms

@receiver(django.db.models.signals.post_save, sender=User)
def default_permissions_post_save(sender, instance, created, raw, **kwargs):
    '''
    Users must have both model-level and object-level permissions to satisfy
    DRF, so assign the newly-created user all available collection and asset
    permissions at the model level
    '''
    if raw:
        # `raw` means we can't touch (so make sure your fixtures include
        # all necessary permissions!)
        return
    if not created:
        # We should only grant default permissions when the user is first
        # created
        return
    grant_default_model_level_perms(instance)

@receiver(django.db.models.signals.post_save, sender=Tag)
def tag_uid_post_save(sender, instance, created, raw, **kwargs):
    ''' Make sure we have a TagUid object for each newly-created Tag '''
    if raw or not created:
        return
    TagUid.objects.get_or_create(tag=instance)

def _update_object_in_index(obj):
    '''
    If a search index exists for the type of `obj`, update it. Otherwise, do
    nothing
    '''
    try:
        index = connections['default'].get_unified_index().get_index(type(obj))
    except NotHandled:
        # There's nothing to update because this type of object is not indexed
        return
    index.update_object(obj)

@receiver(django.db.models.signals.post_save, sender=TaggedItem)
def tagged_item_post_save(sender, instance, created, raw, **kwargs):
    '''
    TaggedItem is the through model for the tag-to-object M2M relationship.
    When a TaggedItem is saved, we need to update the search index for the tag
    itself, as well as the tagged item
    '''
    if raw:
        return
    # Update the search index for the tag itself
    _update_object_in_index(instance.tag)
    # Update the search index for the tagged object
    _update_object_in_index(instance.content_object)

@receiver(django.db.models.signals.post_delete, sender=TaggedItem)
def tagged_item_post_delete(sender, instance, **kwargs):
    _update_object_in_index(instance.tag)
    _update_object_in_index(instance.content_object)
