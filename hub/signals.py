from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import ExtraUserDetail


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_extra_user_details(sender, instance, created, **kwargs):
    if created:
        ExtraUserDetail.objects.get_or_create(user=instance)
