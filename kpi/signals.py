import django.db.models
from django.dispatch import receiver
from django.contrib.auth.models import User
from taggit.models import Tag, TaggedItem
from haystack import connections
from models import Collection, Asset, TagUid
from .model_utils import grant_all_model_level_perms

@receiver(django.db.models.signals.post_save, sender=User)
def default_permissions_post_save(sender, instance, created, raw, **kwargs):
    if raw:
        # `raw` means we can't touch (so make sure your fixtures include
        # all necessary permissions!)
        return
    if not created:
        # We should only grant default permissions when the user is first
        # created
        return
    # Users must have both model-level and object-level permissions to
    # satisfy DRF, so assign the newly-created user all available collection
    # and asset permissions at the model level
    grant_all_model_level_perms(instance, (Collection, Asset))

@receiver(django.db.models.signals.post_save, sender=Tag)
def tag_uid_post_save(sender, instance, created, raw, **kwargs):
    if raw or not created:
        return
    # Make sure we have a TagUid object for each newly-created Tag
    TagUid.objects.get_or_create(tag=instance)

def _update_tag_in_index(tag):
    index = connections['default'].get_unified_index().get_index(Tag)
    index.update_object(tag)

@receiver(django.db.models.signals.post_save, sender=TaggedItem)
def tagged_item_post_save(sender, instance, created, raw, **kwargs):
    if raw:
        return
    _update_tag_in_index(instance.tag)

@receiver(django.db.models.signals.post_delete, sender=TaggedItem)
def tagged_item_post_delete(sender, instance, **kwargs):
    _update_tag_in_index(instance.tag)
