from django.db import transaction

from ..constants import HookLogStatus
from ..models.hook import Hook
from ..models.hook_log import HookLog
from ..tasks import service_definition_task


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
        with transaction.atomic():
            # Create a pending log in case the celery task fails
            log, created = HookLog.objects.get_or_create(
                submission_id=submission_id, 
                hook_id=hook_id,
                defaults={'status': HookLogStatus.PENDING.value},
            )
            if created:
                success = True
                transaction.on_commit(
                    lambda: service_definition_task.delay(hook_id, submission_id)
                )
    return success
