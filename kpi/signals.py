from  django.db import models
from django.dispatch import receiver
from django.contrib.auth.models import User
from taggit.models import Tag
from .models import TagUid
from .model_utils import grant_default_model_level_perms

@receiver(models.signals.post_save, sender=User)
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

@receiver(models.signals.post_save, sender=Tag)
def tag_uid_post_save(sender, instance, created, raw, **kwargs):
    ''' Make sure we have a TagUid object for each newly-created Tag '''
    if raw or not created:
        return
    TagUid.objects.get_or_create(tag=instance)
