from django.contrib.auth.models import User, Permission
from django.dispatch import receiver
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from .models import Collection, Asset
from django.db import models
from django.db.models import Q

@receiver(models.signals.post_save, sender=User)
def assign_default_permissions(sender, instance, created, raw, **kwargs):
    if raw:
        # `raw` means we can't touch (so make sure your fixtures include
        # all necessary permissions!)
        return
    if not created:
        # We should only grant default permissions when the user is first
        # created
        return
    if instance.pk == settings.ANONYMOUS_USER_ID:
        # Anonymous users are handled separately
        return
    # Users must have both model-level and object-level permissions to
    # satisfy DRF, so assign the newly-created user all available collection
    # and asset permissions at the model level
    collection_ctype = ContentType.objects.get_for_model(Collection)
    asset_ctype = ContentType.objects.get_for_model(Asset)
    instance.user_permissions.add(
        *Permission.objects.filter(
            Q(content_type=collection_ctype) |
            Q(content_type=asset_ctype)
        )
    )
