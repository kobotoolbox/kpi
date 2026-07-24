from django.db import transaction

from ..models.hook import Hook
from ..models.hook_log import HookLog
from ..tasks import service_definition_task


def call_services(asset_uid: str, submission_id: int) -> bool:
    """
    Delegates to Celery data submission to remote servers.

    This function is called within KoboCAT's advisory lock transaction context.
    It ensures that the logger.Instance (submission) is fully saved to the database
    before triggering the asynchronous tasks that will send data to external endpoints.
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
        # Create a pending log entry to track this submission attempt.
        # This ensures we maintain a record even if the Celery task is killed
        # (e.g., due to pod OOM or K8s HA events) before successfully POSTing
        # to the external service, allowing for later retry.
        with transaction.atomic():
            _, created = HookLog.objects.get_or_create(
                submission_id=submission_id,
                hook_id=hook_id,
            )
            if created:
                success = True
                transaction.on_commit(
                    lambda: service_definition_task.delay(hook_id, submission_id)
                )
    return success
