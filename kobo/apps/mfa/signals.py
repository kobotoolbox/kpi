# coding: utf-8
from django.db.models.signals import pre_delete
from django.dispatch import receiver

from .models import KoboMFAPerUserActivation, KoboMFAMethod


@receiver(pre_delete, sender=KoboMFAPerUserActivation)
def deactivate_mfa_method_for_user(**kwargs):
    """
    Deactivate MFA methods for user on delete (and bulk delete)
    """
    # We need to use a signal (instead of adding this code to
    # `KoboMFAPerUserActivation.delete()`) because of bulk deletes which do not
    # call `.delete()`.

    mfa_active_user = kwargs['instance']
    # Deactivate any MFA methods user could have already created
    try:
        # Use `.get()` + `.save()` (from model `KoboMFAMethod`) instead of
        # `.update()` to run some logic inside `.save()`. It makes an extra
        # query to DB but avoid duplicated code.
        mfa_method = KoboMFAMethod.objects.get(user=mfa_active_user.user)
    except KoboMFAMethod.DoesNotExist:
        pass
    else:
        mfa_method.is_active = False
        mfa_method.save(update_fields=['is_active'])
