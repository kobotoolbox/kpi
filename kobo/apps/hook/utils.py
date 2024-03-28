# coding: utf-8
from .models.hook_log import HookLog
from .tasks import service_definition_task
from kobo.apps.hook.constants import (
    HookEvent,
    HOOK_EVENT_SUBMIT,
    HOOK_EVENT_EDIT,
    HOOK_EVENT_DELETE,
    HOOK_EVENT_VALIDATION,
)

class HookUtils:

    @staticmethod
    def call_services(asset: 'kpi.models.asset.Asset', submission_id: int, event: HookEvent = HOOK_EVENT_SUBMIT):
        """
        Delegates to Celery data submission to remote servers
        """
        # Retrieve `Hook` ids, to send data to their respective endpoint.
        hooks_ids = (
            asset.hooks.filter(active=True)
            .values_list('id', flat=True)
            .distinct()
        )


        # At least, one of the hooks must not have a log that corresponds to
        # `submission_id`
        # to make success equal True
        success = False
        for hook_id in hooks_ids:
            # if event is submit, or edit, creating a new hook_log exept if it already exist
            # if event is edit, or validation status change, creating a new hook_log anyway
            if event == HOOK_EVENT_SUBMIT or event == HOOK_EVENT_DELETE :
                if not HookLog.objects.filter(
                    submission_id=submission_id, hook_id=hook_id, event=event,
                ).exists():
                    success = True
                    service_definition_task.apply_async(
                        queue='kpi_low_priority_queue', args=(hook_id, submission_id, None, event)
                    )
            elif event == HOOK_EVENT_EDIT or event == HOOK_EVENT_VALIDATION:
                success = True
                service_definition_task.apply_async(
                    queue='kpi_low_priority_queue', args=(hook_id, submission_id, None, event)
                )
            else:
                success = False
        return success
