import logging

from celery.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded
from celery.signals import task_failure, task_retry
from constance import config
from django.conf import settings

from kobo.apps.organizations.constants import UsageType
from kobo.apps.stripe.utils.import_management import requires_stripe
from kobo.celery import celery_app
from ..exceptions import TrashTaskInProgressError
from ..models.attachment import AttachmentTrash
from ..utils import process_deletion, trash_bin_task_failure, trash_bin_task_retry
from ..utils.attachment import delete_attachment


@celery_app.task(
    autoretry_for=(
        TrashTaskInProgressError,
        SoftTimeLimitExceeded,
        TimeLimitExceeded,
    ),
    retry_backoff=60,
    retry_backoff_max=600,
    max_retries=5,
    retry_jitter=False,
    queue='kpi_low_priority_queue',
    soft_time_limit=settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT,
)
def empty_attachment(attachment_trash_id: int, force: bool = False):
    attachment_trash, success = process_deletion(
        AttachmentTrash,
        attachment_trash_id,
        deletion_callback=delete_attachment,
        force=force,
    )
    attachment = attachment_trash.attachment
    if not success:
        logging.warning(
            f'Attachment `{attachment.media_file_basename}` (#{attachment.uid}) '
            f'deletion is already in progress'
        )
    else:
        logging.info(
            f'Attachment `{attachment.media_file_basename}` (#{attachment.uid}) '
            f'has been successfully deleted!'
        )


@task_failure.connect(sender=empty_attachment)
def empty_attachment_failure(sender=None, **kwargs):
    trash_bin_task_failure(AttachmentTrash, **kwargs)


@task_retry.connect(sender=empty_attachment)
def empty_attachment_retry(sender=None, **kwargs):
    trash_bin_task_retry(AttachmentTrash, **kwargs)


# @celery_app.task
@requires_stripe
def schedule_auto_attachment_cleanup_for_users(**stripe_models):
    """
    Identifies users exceeding storage limits beyond the grace period and
    schedules a cleanup task for each.

    Runs only if AUTO_DELETE_ATTACHMENTS and Stripe billing is enabled.
    """
    if not config.AUTO_DELETE_ATTACHMENTS:
        return

    ExceededLimitCounter = stripe_models['exceeded_limit_counter_model']

    exceeded_counters = ExceededLimitCounter.objects.filter(
        limit_type=UsageType.STORAGE_BYTES,
        days__gte=config.LIMIT_ATTACHMENT_REMOVAL_GRACE_PERIOD
    )

    logging.info(f'Found {len(exceeded_counters)} users exceeding storage limits.')

    for counter in exceeded_counters:
        auto_delete_excess_attachments(counter.user_id)


def auto_delete_excess_attachments(user_id: int):
    # ToDo: Implement the logic to auto-delete excess attachments for the user.
    pass
