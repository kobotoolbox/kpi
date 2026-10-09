from collections import defaultdict
from collections.abc import Iterator
from typing import NamedTuple

from celery.exceptions import SoftTimeLimitExceeded
from django.conf import settings
from django.core.cache import cache
from django.db import DatabaseError
from django.db.models import Case, F, OuterRef, Subquery, Sum, When
from django.db.models.functions import Coalesce
from redis.exceptions import LockError

from kpi.deployment_backends.kc_access.utils import conditional_kc_transaction_atomic
from kpi.utils.django_orm_helper import get_distinct_values
from kpi.utils.log import logging
from ...main.models import UserProfile
from ..constants import (
    RECOUNT_STORAGE_ACTIVE_USER_DAYS,
    RECOUNT_STORAGE_LOCK_KEY_PREFIX,
    RECOUNT_STORAGE_ROTATION_CURSOR_KEY,
)
from ..models import Attachment, Instance, XForm


def decrement_counters_after_deletion(
    xform_id: int, user_id: int, count: int, storage_bytes: int = 0
):
    """
    Decrement the submission count of the XForm and the UserProfile, and
    (optionally) the storage bytes of the XForm, in two UPDATE queries.

    Storage is only counted on the XForm: user storage is the sum of their
    projects. `XForm.all_objects` is used so that a trashed project, whose
    deletion fails and which is then restored, keeps an accurate counter.
    """
    xform_fields = {
        'num_of_submissions': Case(
            When(num_of_submissions__gte=count, then=F('num_of_submissions') - count),
            default=0,
        )
    }
    profile_fields = {
        'num_of_submissions': Case(
            When(num_of_submissions__gte=count, then=F('num_of_submissions') - count),
            default=0,
        )
    }
    if storage_bytes:
        xform_fields['attachment_storage_bytes'] = (
            F('attachment_storage_bytes') - storage_bytes
        )

    with conditional_kc_transaction_atomic():
        XForm.all_objects.filter(pk=xform_id).update(**xform_fields)
        UserProfile.objects.filter(user_id=user_id).update(**profile_fields)


def delete_null_user_daily_counters(apps, *args):
    """
    Find any DailyXFormCounters without a user, assign them to a user if we can,
    otherwise delete them.
    This function is reused between two migrations, logger.0030 and logger.0031.
    If/when those migrations get squashed, please delete this function
    """
    DailyXFormSubmissionCounter = apps.get_model(
        'logger', 'DailyXFormSubmissionCounter'
    )  # noqa

    counters_without_users = DailyXFormSubmissionCounter.objects.filter(user=None)

    if not counters_without_users.exists():
        return

    # Associate each daily counter with user=None with a user based on its xform
    batch = []
    batch_size = 5000
    for counter in (
        counters_without_users.exclude(xform=None)
        .exclude(xform__user=None)
        .iterator(chunk_size=batch_size)
    ):
        counter.user = counter.xform.user
        # don't add a user to duplicate counters, so they get deleted when we're
        # done looping
        if (
            DailyXFormSubmissionCounter.objects.filter(
                date=counter.date, xform=counter.xform
            )
            .exclude(user=None)
            .exists()
        ):
            continue
        batch.append(counter)
        if len(batch) >= batch_size:
            DailyXFormSubmissionCounter.objects.bulk_update(batch, ['user_id'])
            batch = []
    if batch:
        DailyXFormSubmissionCounter.objects.bulk_update(batch, ['user_id'])

    # Delete daily counters without a user to avoid creating invalid monthly counters
    DailyXFormSubmissionCounter.objects.filter(user=None).delete()


def get_xform_ids_to_recount(
    last_xform_id: int = 0,
) -> Iterator[tuple[int, list[int]]]:
    """
    Walk every project in batches, in increasing order, after `last_xform_id`,
    and yield for each batch its last project id, to resume after, and the ids
    of the projects whose storage counter is worth recounting:

    - a negative counter, which can only be wrong;
    - at least one attachment which left the active status (trashed,
      restored, soft deleted), where the counter could drift;
    - an owner active in the last `RECOUNT_STORAGE_ACTIVE_USER_DAYS` days,
      since drift that left no trace (e.g. the inactive rows were deleted
      since) is only found by recounting. Inactive owners have not touched
      their projects for that long.

    Only one batch of ids is held at a time.
    """

    # Lazy import to avoid a circular dependency through the usage calculator
    from kobo.apps.mass_emails.user_queries import get_active_users

    while rows := list(
        XForm.all_objects.filter(pk__gt=last_xform_id).order_by('pk')
        # Use values_list instead values to be light on memory
        .values_list('pk', 'user_id', 'attachment_storage_bytes')[
            : settings.DEFAULT_BATCH_SIZE
        ]
    ):
        first_xform_id, last_xform_id = rows[0][0], rows[-1][0]
        # The batch holds every project between its first and last ids, so a
        # range finds its projects with inactive attachments through the
        # partial index on them
        suspected_xform_ids = set(
            get_distinct_values(
                Attachment.all_objects.filter(
                    delete_status__isnull=False,
                    xform_id__gte=first_xform_id,
                    xform_id__lte=last_xform_id,
                ),
                'xform_id',
                limit=len(rows),
            )
        )
        active_user_ids = set(
            get_active_users(days=RECOUNT_STORAGE_ACTIVE_USER_DAYS)
            .filter(pk__in={row[1] for row in rows})
            .values_list('pk', flat=True)
        )
        yield last_xform_id, [
            xform_id
            for xform_id, user_id, storage_bytes in rows
            if storage_bytes < 0
            or xform_id in suspected_xform_ids
            or user_id in active_user_ids
        ]


def recount_next_drifted_storage_counters():
    """
    Recount the projects returned by `get_xform_ids_to_recount()`, resuming
    after the last one recounted, until every one was checked or Celery's soft
    time limit stops it. The cursor is saved after each project, so a run
    interrupted at any time loses at most the project in progress.

    Meant for `recount_drifted_storage_counters()`, which holds the lock while
    it runs.
    """

    stats = defaultdict(int)
    first_xform_id = last_xform_id = cache.get(RECOUNT_STORAGE_ROTATION_CURSOR_KEY, 0)
    completed = False

    if not first_xform_id:
        # With `Turn completed`, gives how long a whole turn takes
        logging.info('[Storage recount] - Turn started')

    try:
        for batch_last_xform_id, xform_ids in get_xform_ids_to_recount(last_xform_id):
            for xform_id in xform_ids:
                _recount_and_log(xform_id, stats)
                last_xform_id = xform_id
                cache.set(RECOUNT_STORAGE_ROTATION_CURSOR_KEY, xform_id, timeout=None)
            # Projects of the batch not worth recounting are skipped too
            last_xform_id = batch_last_xform_id
            cache.set(RECOUNT_STORAGE_ROTATION_CURSOR_KEY, last_xform_id, timeout=None)

        # Every project was checked, the next run starts over
        cache.delete(RECOUNT_STORAGE_ROTATION_CURSOR_KEY)
        completed = True
    except SoftTimeLimitExceeded:
        # The run is over. The next one resumes after the last project whose
        # cursor was saved; one interrupted mid-recount is simply redone.
        pass
    finally:
        logging.info(
            f'[Storage recount] - {stats["checked"]} projects checked,'
            f' {stats["drifted"]} drifted ({stats["drift"]:+} bytes),'
            f' {stats["failed"]} failed, from xform #{first_xform_id}'
            f' to #{last_xform_id}'
        )

    if completed:
        logging.info('[Storage recount] - Turn completed')


class StorageRecount(NamedTuple):
    xform_id: int
    user_id: int
    counter: int
    real: int

    @property
    def drift(self) -> int:
        return self.real - self.counter


def recount_storage_counter(
    xform_id: int, dry_run: bool = False
) -> StorageRecount | None:
    """
    Fix the storage counter of a project from the attachments it actually
    holds, and return its value before the fix and the real storage. Return
    `None` if the project does not exist, or another recount of it runs.

    Nothing is locked while the attachments are summed, which can take a while
    on a large project: submissions keep coming. The counter and the sum are
    read by the same statement, so from the same snapshot, where they only
    differ by the drift: every change of an attachment updates the counter in
    the same transaction. Only that drift is then added to the counter, so a
    submission committed meanwhile keeps the bytes it added itself.

    Running it twice changes nothing the second time, but two recounts of the
    same project at once would both add the drift. The cache lock prevents
    that; it does not hold back submissions.
    """

    lock = cache.lock(
        f'{RECOUNT_STORAGE_LOCK_KEY_PREFIX}{xform_id}',
        timeout=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT,
    )
    if not lock.acquire(blocking=False):
        logging.info(f'Storage of xform #{xform_id} is already being recounted')
        return None

    try:
        real_storage = Coalesce(
            Subquery(
                Attachment.objects.filter(xform_id=OuterRef('pk'))
                .order_by()
                .values('xform_id')
                .annotate(total=Sum('media_file_size'))
                .values('total')
            ),
            0,
        )
        row = (
            XForm.all_objects.filter(pk=xform_id)
            .annotate(real_storage=real_storage)
            .values_list('user_id', 'attachment_storage_bytes', 'real_storage')
            .first()
        )
        if row is None:
            return None

        recount = StorageRecount(xform_id, *row)
        if not dry_run:
            update_storage_counters({xform_id: recount.drift})
        return recount
    finally:
        # The lock outlives any recount, so it is still ours here, unless
        # Redis lost the key (restart, eviction). `release()` raises then, and
        # must not hide the recount's own result or error
        try:
            lock.release()
        except LockError as e:
            logging.warning(f'Recount lock of xform #{xform_id} was lost: {e}')


def update_storage_counters(storage_bytes_by_xform_id: dict[int, int]):
    """
    Add the bytes of each project (negative to subtract) to its storage
    counter. User storage is the sum of their projects, so there is nothing
    else to update.

    Call it inside the transaction that changed the attachments, as late as
    possible, so the rows stay locked briefly and both are rolled back
    together.
    """

    # A loop rather than `bulk_update()`: a single `UPDATE ... WHERE id IN
    # (...)` locks the rows in whatever order PostgreSQL scans them, so two
    # concurrent calls on the same projects could each hold a row the other
    # waits for, and deadlock. Sorted single-row updates always lock in `pk`
    # order. Calls usually touch one project (API, restore, signals), a few at
    # most (auto-deletion), so the extra round trips are cheap.
    for xform_id, storage_bytes in sorted(storage_bytes_by_xform_id.items()):
        if not storage_bytes:
            continue
        XForm.all_objects.filter(pk=xform_id).update(
            attachment_storage_bytes=F('attachment_storage_bytes') + storage_bytes
        )


def update_user_counters(
    instance: Instance,
    user_id: int,
    attachment_storage_bytes: int = 0,
    increase_num_of_submissions: bool = False,
):
    """
    Update the submission and storage counters of the XForm, and the
    submission counter of its owner's profile.

    Storage is only counted on the XForm: user storage is the sum of their
    projects. If the user's profile does not exist yet, it is created
    automatically to ensure the counters remain consistent.
    """

    xform_fields = {}
    profile_fields = {}
    if increase_num_of_submissions:
        xform_fields['num_of_submissions'] = F('num_of_submissions') + 1
        xform_fields['last_submission_time'] = instance.date_created
        profile_fields['num_of_submissions'] = F('num_of_submissions') + 1

    if attachment_storage_bytes:
        xform_fields['attachment_storage_bytes'] = (
            F('attachment_storage_bytes') + attachment_storage_bytes
        )

    with conditional_kc_transaction_atomic():
        # Update related XForm counters. `all_objects` because the project may
        # be trashed while the submission is being saved, and its counter must
        # still match its attachments if it is restored.
        if xform_fields:
            XForm.all_objects.filter(pk=instance.xform_id).update(**xform_fields)

        # Update related UserProfile counters.
        # If no rows were affected, the profile does not exist yet.
        # Create it first, then re-run the update query.
        if profile_fields and not UserProfile.objects.filter(user_id=user_id).update(
            **profile_fields
        ):
            # This only triggers an extra query once per missing profile.
            # It avoids the redundant SELECT we previously used for every
            # new submission.
            UserProfile.objects.only('pk').get_or_create(user_id=instance.xform.user_id)
            UserProfile.objects.filter(user_id=user_id).update(**profile_fields)


def _recount_and_log(xform_id: int, stats: defaultdict):
    """
    Recount the storage counter of a project and log the drift fixed, if any
    """

    try:
        recount = recount_storage_counter(xform_id)
    except DatabaseError as e:
        # E.g. a statement timeout on a huge project: the others still get
        # recounted, and this one is tried again on the next turn
        stats['failed'] += 1
        logging.error(f'[Storage recount] - Could not recount xform #{xform_id}: {e}')
        return

    if recount is None:
        return

    stats['checked'] += 1
    if recount.drift:
        stats['drifted'] += 1
        stats['drift'] += recount.drift
        logging.info(
            f'[Storage recount] - storage_counter_drift xform_id={xform_id}'
            f' user_id={recount.user_id} counter={recount.counter}'
            f' real={recount.real} drift={recount.drift}'
        )
