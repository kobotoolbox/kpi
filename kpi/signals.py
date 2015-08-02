from django.dispatch import receiver
from django.contrib.auth.models import User
import django.db.models
from models import Collection, Asset
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
