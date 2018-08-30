# -*- coding: utf-8 -*-
from __future__ import absolute_import

from .models.hook_log import HookLog
from .tasks import service_definition_task


class HookUtils(object):

    @staticmethod
    def call_services(asset, instance_uuid):
        """
        Delegates to Celery data submission to remote servers

        :param asset: Asset.
        :param instance_uuid: str. `Instance.uuid`
        """
        # Retrieve `Hook` ids, to send data to their respective endpoint.
        hooks_ids = asset.hooks.filter(active=True).values_list("id", flat=True).distinct()
        # At least, one of the hooks must not have a log that corresponds to `instance_uuid`
        # to make success equal True
        success = False
        for hook_id in hooks_ids:
            if not HookLog.objects.filter(instance_uuid=instance_uuid, hook_id=hook_id).exists():
                success = True
                service_definition_task.delay(hook_id, instance_uuid)

        return success
