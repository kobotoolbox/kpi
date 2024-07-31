# coding: utf-8
from .models.hook import Hook
from .models.hook_log import HookLog
from .tasks import service_definition_task


class HookUtils:

    @staticmethod
    def call_services(asset_uid: str, submission_id: int) -> bool:
        """
        Delegates to Celery data submission to remote servers
        """
        # Retrieve `Hook` ids, to send data to their respective endpoint.
        hooks_ids = (
            Hook.objects.filter(asset__uid=asset_uid, active=True)
            .values_list('id', flat=True)
            .distinct()
        )
        # At least, one of the hooks must not have a log that corresponds to
        # `submission_id`
        # to make success equal True
        success = False
        for hook_id in hooks_ids:
            if not HookLog.objects.filter(
                submission_id=submission_id, hook_id=hook_id
            ).exists():
                success = True
                service_definition_task.apply_async(
                    queue='kpi_low_priority_queue', args=(hook_id, submission_id)
                )

        return success
