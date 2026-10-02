import logging

from celery.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded
from celery.signals import task_failure, task_retry
from constance import config
from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from redis.exceptions import LockError

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Attachment
from kobo.apps.openrosa.apps.viewer.models.parsed_instance import ParsedInstance
from kobo.apps.organizations.constants import UsageType
from kobo.apps.stripe.utils.import_management import requires_stripe
from kobo.apps.stripe.utils.limit_enforcement import update_or_remove_limit_counter
from kobo.celery import celery_app
from kpi.models import Asset
from kpi.utils.usage_calculator import ServiceUsageCalculator
from ..constants import AUTO_DELETE_CURSOR_KEY
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
    schedules a cleanup task for `AUTO_DELETE_ATTACHMENTS_USERS_PER_RUN` of
    them.

    Users take turns: each run starts after the last counter of the previous
    run (in `id` order), and starts over from the first one once the end is
    reached. Every user gets a turn, without queuing all of them at once.

    Runs only if AUTO_DELETE_ATTACHMENTS and Stripe billing is enabled.
    """
    if not config.AUTO_DELETE_ATTACHMENTS:
        return

    ExceededLimitCounter = stripe_models['exceeded_limit_counter_model']
    users_per_run = settings.AUTO_DELETE_ATTACHMENTS_USERS_PER_RUN

    exceeded_counters = ExceededLimitCounter.objects.filter(
        limit_type=UsageType.STORAGE_BYTES,
        days__gte=config.OVER_LIMIT_ATTACHMENT_RETENTION,
    ).order_by('id')

    cursor = cache.get(AUTO_DELETE_CURSOR_KEY) or 0
    counters = list(
        exceeded_counters.filter(id__gt=cursor).values_list('id', 'user_id')[
            :users_per_run
        ]
    )
    if not counters and cursor:
        # The previous run reached the end, start over from the first one
        cursor = 0
        counters = list(exceeded_counters.values_list('id', 'user_id')[:users_per_run])

    logging.info(
        f'Found {exceeded_counters.count()} users exceeding storage limits, '
        f'scheduling cleanup for {len(counters)} of them.'
    )

    queued = 0
    try:
        for _, user_id in counters:
            auto_delete_excess_attachments.delay(user_id)
            queued += 1
    finally:
        # Only move past the users actually queued. If queuing fails half-way,
        # the next run starts with the first user left out
        if queued < len(counters):
            next_cursor = counters[queued - 1][0] if queued else cursor
        elif len(counters) == users_per_run:
            next_cursor = counters[-1][0]
        else:
            # A shorter run reached the end, the next one starts over
            next_cursor = 0
        # No expiry: if the key is lost, the next run simply starts over
        cache.set(AUTO_DELETE_CURSOR_KEY, next_cursor, None)


@celery_app.task(queue='kpi_low_priority_queue')
@requires_stripe
def auto_delete_excess_attachments(user_id: int, **stripe_models):
    """
    Move the oldest attachments of `user_id` to trash until they are back
    under their storage limit, `AUTO_DELETE_ATTACHMENTS_MAX_PER_USER` at most
    per run. A user still over their limit gets the next ones on a later run
    """
    # Tasks already in the queue when the feature is turned off must not run
    if not config.AUTO_DELETE_ATTACHMENTS:
        logging.info(f'Auto-deletion is disabled, nothing trashed for user `{user_id}`')
        return

    lock = cache.lock(
        f'auto_delete_excess_attachments_lock_for_user_{user_id}',
        timeout=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT,
    )
    if not lock.acquire(blocking=False):
        logging.info(f'Lock already held for user `{user_id}`')
        return

    try:
        _trash_excess_attachments(
            user_id, stripe_models['exceeded_limit_counter_model']
        )
    finally:
        # The lock outlives the task's time limit, so it is still ours here,
        # unless Redis lost the key (restart, eviction). `release()` raises
        # then, and must not hide the task's own result or error
        try:
            lock.release()
        except LockError as e:
            logging.warning(f'Lock was not released for user `{user_id}`: {e}')


def _trash_excess_attachments(user_id: int, exceeded_limit_counter_model):
    """
    Do the work of `auto_delete_excess_attachments()`, which holds the lock of
    `user_id` while it runs
    """
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

    max_per_user = settings.AUTO_DELETE_ATTACHMENTS_MAX_PER_USER
    attachments_to_trash = []
    submission_ids = set()
    trashed_bytes = 0
    for att, asset_id in _iter_trashable_attachments(user_id):
        attachments_to_trash.append(
            {
                'pk': att['pk'],
                'asset_id': asset_id,
                'asset_uid': att['xform__kpi_asset_uid'],
                'attachment_uid': att['uid'],
                'attachment_basename': att['media_file_basename'],
            }
        )
        submission_ids.add(att['instance_id'])
        trashed_bytes += att['media_file_size'] or 0
        if trashed_bytes >= exceeded_bytes:
            break
        if len(attachments_to_trash) == max_per_user:
            logging.info(
                f'User `{user_id}` reached the limit of {max_per_user} '
                f'attachments per run, the next run continues'
            )
            break

    if attachments_to_trash:
        move_to_trash(
            user,
            attachments_to_trash,
            config.ATTACHMENT_TRASH_RETENTION,
            'attachment',
        )

        # Update the `is_deleted` flag in Mongo
        ParsedInstance.bulk_update_attachments(list(submission_ids))

        # Clear the cache and update the limit counter
        ServiceUsageCalculator(user).clear_cache()
        counter = (
            exceeded_limit_counter_model.objects.filter(
                user=user, limit_type=UsageType.STORAGE_BYTES
            )
            .select_related('user')
            .first()
        )
        if counter:
            update_or_remove_limit_counter(counter)
    else:
        logging.info(f'No attachments to trash for user `{user_id}`.')


def _iter_trashable_attachments(user_id: int):
    """
    Yield the active attachments of `user_id` that can be moved to trash,
    oldest first, with the ID of their project

    An attachment without a project cannot be trashed: the trash logs it in
    the project history. Forms created before KPI have no project at all, the
    query leaves them out. The few left whose project cannot be found are
    skipped, and reading goes on after them, page by page, so that they never
    hold back the newer attachments.
    """

    page_size = settings.AUTO_DELETE_ATTACHMENTS_MAX_PER_USER
    # Oldest first, `pk` breaks ties so that a later run picks up exactly where
    # this one stopped. Trashed attachments are excluded by the default manager
    queryset = (
        Attachment.objects.filter(user_id=user_id, xform__kpi_asset_uid__isnull=False)
        .order_by('date_created', 'pk')
        .values(
            'pk',
            'uid',
            'media_file_basename',
            'media_file_size',
            'instance_id',
            'date_created',
            'xform__kpi_asset_uid',
        )
    )
    last = None
    while True:
        page_queryset = queryset
        if last:
            page_queryset = queryset.filter(
                Q(date_created__gt=last['date_created'])
                | Q(date_created=last['date_created'], pk__gt=last['pk'])
            )
        page = list(page_queryset[:page_size])
        if not page:
            return

        # Assets live in the KPI database, they cannot be joined from the
        # attachments. Fetch the ones of the page at once
        asset_ids = dict(
            Asset.all_objects.filter(
                uid__in={att['xform__kpi_asset_uid'] for att in page}
            ).values_list('uid', 'pk')
        )
        for att in page:
            if (asset_id := asset_ids.get(att['xform__kpi_asset_uid'])) is None:
                logging.warning(
                    f'Attachment #{att["pk"]} of user `{user_id}` has no project, '
                    f'not trashed'
                )
                continue
            yield att, asset_id

        if len(page) < page_size:
            return
        last = page[-1]
