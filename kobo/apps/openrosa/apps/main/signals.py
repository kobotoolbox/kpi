from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.main.models.user_profile import UserProfile
from kobo.apps.openrosa.libs.utils.guardian import (
    assign_perm,
    get_perms_for_model
)
from kobo.apps.openrosa.libs.utils.user_auth import set_api_permissions_for_user
from kpi.utils.database import use_db
from kpi.utils.permissions import is_user_anonymous


# TODO Get rid of this, seems to be needed for KC unit tests only.
#  KPI does create KC permissions when its calling `grant_kc_model_level_perms()`
#   in `kpi.signals.save_kobocat_user()`

@receiver(post_save, sender=User, dispatch_uid='set_api_permissions')
def set_api_permissions(sender, instance=None, created=False, **kwargs):
    if is_user_anonymous(instance):
        return

    if created:
        with use_db(settings.OPENROSA_DB_ALIAS):
            if User.objects.filter(pk=instance.pk).exists() or settings.TESTING:
                set_api_permissions_for_user(instance)


@receiver(post_save, sender=UserProfile, dispatch_uid='set_object_permissions')
def set_object_permissions(sender, instance=None, created=False, **kwargs):
    if created:
        with use_db(settings.OPENROSA_DB_ALIAS):
            if User.objects.filter(pk=instance.pk).exists() or settings.TESTING:
                for perm in get_perms_for_model(UserProfile):
                    assign_perm(perm.codename, instance.user, instance)
