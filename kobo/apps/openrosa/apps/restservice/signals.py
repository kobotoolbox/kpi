# coding: utf-8
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from kobo.apps.openrosa.apps.restservice import SERVICE_KPI_HOOK
from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.openrosa.apps.restservice.models import RestService


@receiver(post_save, sender=XForm)
def save_kpi_hook_service(sender, instance, **kwargs):
    """
    Creates/Deletes Kpi hook Rest service related to XForm instance
    :param sender: XForm class
    :param instance: XForm instance
    :param kwargs: dict
    """
    kpi_hook_service = instance.kpi_hook_service
    if instance.has_kpi_hooks:
        # Only register the service if it hasn't been created yet.
        if kpi_hook_service is None:
            # For retro-compatibility, if `asset_uid` is null, fallback on
            # `id_string`
            asset_uid = instance.kpi_asset_uid if instance.kpi_asset_uid \
                else instance.id_string
            kpi_hook_service = RestService(
                service_url=settings.KPI_HOOK_ENDPOINT_PATTERN.format(
                    asset_uid=asset_uid),
                xform=instance,
                name=SERVICE_KPI_HOOK[0]
            )
            kpi_hook_service.save()
    elif kpi_hook_service is not None:
        # Only delete the service if it already exists.
        kpi_hook_service.delete()
