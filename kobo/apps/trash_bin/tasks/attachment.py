import logging

from celery.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded
from celery.signals import task_failure, task_retry
from constance import config
from django.conf import settings
from django.core.cache import cache

from kobo.apps.openrosa.apps.logger.models import Attachment
from kobo.apps.organizations.constants import UsageType
from kobo.apps.stripe.utils.import_management import requires_stripe
from kobo.apps.kobo_auth.shortcuts import User
from kobo.celery import celery_app
from kpi.utils.usage_calculator import ServiceUsageCalculator
from ..exceptions import TrashTaskInProgressError
from ..models.attachment import AttachmentTrash
from ..utils import (
    move_to_trash,
    process_deletion,
    trash_bin_task_failure,
    trash_bin_task_retry,
)
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


@celery_app.task
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
        auto_delete_excess_attachments.delay(counter.user_id)


@celery_app.task(queue='kpi_low_priority_queue')
def auto_delete_excess_attachments(user_id: int):
    cache_key = f'auto_delete_excess_attachments_lock_for_user_{user_id}'
    lock_timeout = settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT
    with cache.lock(
        cache_key, timeout=lock_timeout, blocking_timeout=0
    ) as lock_acquired:
        if not lock_acquired:
            logging.info(f'Lock already held for user `{user_id}`')
            return

    user = User.objects.get(pk=user_id)
    usage_balance = ServiceUsageCalculator(user).get_usage_balances()

    balance_info = usage_balance.get(UsageType.STORAGE_BYTES)
    if not balance_info:
        logging.info(f'No storage balance info found for user `{user_id}`.')
        return

    if not balance_info.get('exceeded', False):
        logging.info(f'User `{user_id}` is within storage limits.')
        return

    exceeded_bytes = balance_info['balance_value'] * -1
    logging.info(
        f'User `{user_id}` has exceeded storage limits by {exceeded_bytes} bytes.'
    )

    attachments_to_trash = []
    trashed_bytes = 0
    queryset = Attachment.objects.filter(user_id=user_id).order_by('date_created').only(
        'pk', 'uid', 'media_file_basename', 'media_file_size'
    )

    for att in queryset.iterator():
        attachments_to_trash.append({
            'pk': att.pk,
            'attachment_uid': att.uid,
            'attachment_basename': att.media_file_basename,
        })
        trashed_bytes += att.media_file_size
        if trashed_bytes >= exceeded_bytes:
            break

    if attachments_to_trash:
        move_to_trash(
            user,
            attachments_to_trash,
            config.ATTACHMENT_TRASH_GRACE_PERIOD,
            'attachment',
        )
    else:
        logging.info(f'No attachments to trash for user `{user_id}`.')
