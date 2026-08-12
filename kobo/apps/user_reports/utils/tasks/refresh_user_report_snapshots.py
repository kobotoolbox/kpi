"""
Building blocks for `refresh_user_report_snapshots`, minus the Celery
plumbing (the task itself lives in `kobo.apps.user_reports.tasks` and calls
straight into these).

A full pass over every organization can outlive a single invocation, so a
pass is modelled as a `BillingAndUsageSnapshotRun` that successive
invocations resume through its `last_processed_org_id` cursor, until one of
them completes it.

Two mechanisms keep concurrent invocations apart. The Redis lock held by
the task itself stops a second worker from starting, and expires on its own
if a worker dies without releasing it. Under it, `owned_run()` is the
backstop: whoever claims a run stamps a token on it, and every write
carries that token as a condition, so a worker whose lock has already
expired (and been reacquired by a replacement) can no longer write to a run
someone else took over.
"""

from datetime import timedelta
from math import inf

from django.conf import settings
from django.db import connection
from django.db.models import Exists, Q
from django.db.models.query import QuerySet
from django.utils import timezone

from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.utils.billing_dates import get_current_billing_period_dates_by_org
from kobo.apps.stripe.utils.subscription_limits import (
    get_organizations_effective_limits,
)
from kobo.apps.user_reports.exceptions import RunTakenOver
from kobo.apps.user_reports.models import (
    BillingAndUsageSnapshot,
    BillingAndUsageSnapshotRun,
    BillingAndUsageSnapshotStatus,
)
from kobo.apps.user_reports.typing_aliases import OrganizationIterator
from kobo.apps.user_reports.utils.billing_and_usage_calculator import (
    BillingAndUsageCalculator,
)
from kpi.utils.django_orm_helper import UpdateJSONFieldAttributes
from kpi.utils.log import logging

CHUNK_SIZE = 1000


def complete_run(run: BillingAndUsageSnapshotRun, owner_token: str):
    """
    Refresh the view and complete the run, provided we still own it.

    A run only reaches `completed` once its view refresh has succeeded too,
    not just its data: if the refresh fails it stays `in_progress`, so the
    next invocation resumes it - bypassing the cooldown - and retries just
    the refresh instead of leaving the view stale for hours.
    """
    refreshed = refresh_view(run, owner_token)
    completed = owned_run(run.pk, owner_token).update(
        status=(
            BillingAndUsageSnapshotStatus.COMPLETED
            if refreshed
            else BillingAndUsageSnapshotStatus.IN_PROGRESS
        ),
        details=UpdateJSONFieldAttributes(
            'details', updates={'mv_refresh_failed': not refreshed}
        ),
        date_modified=timezone.now(),
    )
    if completed and refreshed:
        logging.info(f'[Refresh MV]: Marked run as complete (#{run.uid})')


def get_or_create_run() -> BillingAndUsageSnapshotRun:
    """
    Get or create a `BillingAndUsageSnapshotRun` with status `IN_PROGRESS`
    """
    run, _ = BillingAndUsageSnapshotRun.objects.get_or_create(
        status=BillingAndUsageSnapshotStatus.IN_PROGRESS,
        defaults={'details': {}},
    )

    # TODO Added for retro-compatibility, delete in few release.
    if run.details is None:
        run.details = {}

    return run


def is_in_cooldown() -> bool:
    """
    Whether starting a brand-new pass would come too soon after the last one.

    An in-progress run is always resumed, cooldown or not, so this only
    gates the creation of a new one.
    """
    if BillingAndUsageSnapshotRun.objects.filter(
        status=BillingAndUsageSnapshotStatus.IN_PROGRESS
    ).exists():
        return False

    last_completed = (
        BillingAndUsageSnapshotRun.objects.filter(
            status=BillingAndUsageSnapshotStatus.COMPLETED
        )
        .order_by('-date_modified')
        .first()
    )
    min_interval = timedelta(hours=settings.USER_REPORTS_SNAPSHOT_MIN_INTERVAL_HOURS)
    if last_completed and timezone.now() - last_completed.date_modified < min_interval:
        logging.info(
            '[Refresh MV]: Nothing to do, last run completed less than '
            f'{settings.USER_REPORTS_SNAPSHOT_MIN_INTERVAL_HOURS}h ago'
        )
        return True

    return False


def owned_run(run_pk: int, owner_token: str):
    """
    The run, but only while `owner_token` is still the one stamped on it.

    Writing through this queryset is what makes ownership impossible to lose
    between a check and the write it protects: the condition travels inside
    the same statement, so an `update()` returning 0 rows means another
    worker has claimed the run and this one must stop.
    """

    return BillingAndUsageSnapshotRun.objects.filter(
        pk=run_pk, details__owner_token=owner_token
    )


def process_organizations(run: BillingAndUsageSnapshotRun, owner_token: str):
    """
    Walk organizations in key-set chunks, refreshing each one's snapshot.

    Resumes at the run's cursor and stops when it reaches the end, then
    drops the snapshots no organization claimed during this pass.
    """
    calc = BillingAndUsageCalculator()
    last_processed_org_id = run.last_processed_org_id or ''

    while chunk_qs := _iter_org_chunks_after(last_processed_org_id):
        logging.info(
            f'[Refresh MV]: Processing queue (#{run.uid}), '
            f'last_processed_org_id: {last_processed_org_id}'
        )
        billing_map = get_current_billing_period_dates_by_org(chunk_qs)
        limits_map = get_organizations_effective_limits(chunk_qs, True, True)
        usage_map = calc.calculate_usage_batch(chunk_qs, billing_map)
        last_processed_org_id = _process_chunk(chunk_qs, usage_map, limits_map, run.pk)

        # Persist progress so a resumed invocation picks up where this one
        # left off. Doubles as the ownership test for the next chunk: if
        # another worker claimed the run meanwhile, no row matches.
        if not owned_run(run.pk, owner_token).update(
            last_processed_org_id=last_processed_org_id,
            date_modified=timezone.now(),
        ):
            raise RunTakenOver
        logging.info(
            f'[Refresh MV]: Progress saved (#{run.uid}), '
            f'new last_processed_org_id: {last_processed_org_id}'
        )

    # Every organization processed. Deleting the snapshots left over from
    # earlier passes is the one step that touches rows this pass never
    # wrote, so claim the right to do it first.
    if not owned_run(run.pk, owner_token).update(date_modified=timezone.now()):
        raise RunTakenOver

    # Chunked so each batch commits on its own rather than piling up one
    # long-running transaction (deletion, unlike the upserts above, is not
    # safe to duplicate). `owner_token` guards every chunk's delete, not
    # just the claim above: a pass with many stale rows can span several
    # chunks, long enough for this worker's lock to expire and a
    # replacement to take over and start its own pass, so a per-chunk
    # check stops this one from deleting rows the replacement has since
    # written under the same run id.
    logging.info(f'[Refresh MV]: Clean-up (#{run.uid})')
    _cleanup_stale_snapshots(run.pk, owner_token)
    logging.info(f'[Refresh MV]: All organizations processed (#{run.uid})')


def refresh_user_reports_materialized_view(concurrently=True):
    """
    Refreshes the user reports materialized view (optionally concurrently)
    """
    concurrent_keyword = ' CONCURRENTLY' if concurrently else ''
    sql = f'REFRESH MATERIALIZED VIEW{concurrent_keyword} user_reports_userreportsmv;'

    with connection.cursor() as cursor:
        cursor.execute(sql)


def refresh_view(run: BillingAndUsageSnapshotRun, owner_token: str) -> bool:
    """
    Refresh the materialized view, returning whether it got refreshed.

    Every path that refreshes goes through here, so this is also where a
    worker that no longer owns the run stands down. Not for safety - the
    refresh is idempotent and only ever makes the view fresher - but
    because the run's new owner refreshes at the end of its own pass, which
    makes this one a redundant global refresh.
    """

    if not owned_run(run.pk, owner_token).exists():
        logging.warning(
            f'[Refresh MV]: Another worker owns this run now (#{run.uid}), '
            'leaving the view to it'
        )
        return False

    try:
        refresh_user_reports_materialized_view()
    except Exception as ex:
        logging.warning(f'[Refresh MV]: Failed to refresh the view: {ex}')
        return False

    return True


def _cleanup_stale_snapshots(run_id: str, owner_token: str):
    """
    Delete snapshot rows that were not touched by the given run

    Each chunk's delete carries the ownership check inside the same
    statement, as an `Exists()` against the run row, instead of checking
    beforehand and deleting after: a separate check-then-delete would still
    leave a window between the two for a replacement worker to claim the
    run and write one of the very rows about to be deleted.
    """
    still_owned = Exists(owned_run(run_id, owner_token))
    while True:
        stale_ids = list(
            BillingAndUsageSnapshot.objects.filter(
                ~Q(last_snapshot_run_id=run_id)
            ).values_list('pk', flat=True)[:CHUNK_SIZE]
        )
        if not stale_ids:
            break
        deleted, _ = (
            BillingAndUsageSnapshot.objects.filter(pk__in=stale_ids)
            .filter(still_owned)
            .delete()
        )
        if not deleted:
            raise RunTakenOver


def _iter_org_chunks_after(last_processed_org_id: str) -> QuerySet[Organization]:
    """
    Iterate organizations in key set chunks
    """
    return Organization.objects.filter(pk__gt=last_processed_org_id).order_by('pk')[
        :CHUNK_SIZE
    ]


def _normalize_limit(limit: int | float | None) -> int | None:
    """
    Normalize limit values for database storage
    """
    if limit is None:
        return None
    if limit == inf:
        return None
    return int(limit)


def _process_chunk(
    chunk_qs: OrganizationIterator, usage_map: dict, limits_map: dict, run_id: int
) -> str | None:
    """
    Apply usage data for a chunk of organizations and persist changes

    For each organization in the chunk:
        - If a snapshot already exists, update it with the latest usage data.
        - If no snapshot exists, create a new entry.

    Returns the last processed organization ID
    """

    objs = []
    last_org_id = None

    for org_id in chunk_qs.values_list('id', flat=True):
        last_org_id = org_id
        d = usage_map.get(org_id, {})
        org_limits = limits_map.get(org_id, {})

        objs.append(
            BillingAndUsageSnapshot(
                organization_id=org_id,
                effective_user_id=d.get('effective_user_id'),
                total_storage_bytes=d.get('total_storage_bytes', 0),
                total_submission_count_all_time=d.get(
                    'total_submission_count_all_time', 0
                ),
                total_submission_count_current_period=d.get(
                    'total_submission_count_current_period', 0
                ),
                billing_period_start=d.get('billing_period_start'),
                billing_period_end=d.get('billing_period_end'),
                last_snapshot_run_id=run_id,
                submission_limit=_normalize_limit(org_limits.get('submission_limit')),
                storage_bytes_limit=_normalize_limit(
                    org_limits.get('storage_bytes_limit')
                ),
                asr_seconds_limit=_normalize_limit(org_limits.get('asr_seconds_limit')),
                mt_characters_limit=_normalize_limit(
                    org_limits.get('mt_characters_limit')
                ),
                llm_requests_limit=_normalize_limit(
                    org_limits.get('llm_requests_limit')
                ),
                date_modified=timezone.now(),
            )
        )

    if objs:
        BillingAndUsageSnapshot.objects.bulk_create(
            objs,
            update_conflicts=True,
            update_fields=[
                'effective_user_id',
                'total_storage_bytes',
                'total_submission_count_all_time',
                'total_submission_count_current_period',
                'billing_period_start',
                'billing_period_end',
                'last_snapshot_run_id',
                'submission_limit',
                'storage_bytes_limit',
                'asr_seconds_limit',
                'mt_characters_limit',
                'llm_requests_limit',
                'date_modified',
            ],
            unique_fields=['organization_id'],
        )

    return last_org_id
