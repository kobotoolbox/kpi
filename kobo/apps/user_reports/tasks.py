from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from kobo.apps.stripe.utils.billing_dates import get_current_billing_period_dates_by_org
from kobo.apps.user_reports.models import (
    BillingAndUsageSnapshotRun,
    BillingAndUsageSnapshotStatus,
)
from kobo.apps.user_reports.utils.billing_and_usage_calculator import (
    BillingAndUsageCalculator
)
from kobo.apps.user_reports.utils.snapshot_refresh_helpers import (
    cleanup_stale_snapshots_and_refresh_mv,
    get_or_create_run,
    iter_org_chunks_after,
    process_chunk,
)
from kobo.celery import celery_app
from kpi.utils.log import logging


@celery_app.task(
    queue='kpi_low_priority_queue',
    soft_time_limit=settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT,
)
def refresh_user_report_snapshots():
    """
    Refresh `BillingAndUsageSnapshot` table in batches

    Core Features:
        - Redis Lock:
            Prevents concurrent workers from running this task at the same time.
            If a lock already exists, the task exits immediately.
        - Snapshot Run Tracking (`BillingAndUsageSnapshotRun`):
            Tracks the progress of each run (status, last_processed_org_id, details).
            Allows the task to resume from where it left off after failure or
            pod restarts.
        - Incremental Batching:
            Uses key-set pagination to process organizations in ordered chunks
            without performance penalties (no OFFSET).

    Workflow:
        1. Acquire a non-blocking Redis lock (`billing_and_usage_snapshot:run_lock`)
           with TTL = hard time limit + safety margin.
           - If lock not acquired; exit (another worker is already processing).
        2. Fetch or create an active snapshot run (status = 'running'):
           - If no active run exists, create a new one (cursor reset).
           - If exists, resume from `last_processed_org_id`.
        3. Iterate organizations in key-set chunks:
           - Compute usage data for the batch using `BillingAndUsageCalculator`.
           - Upsert (`bulk_update` + `bulk_create`) `BillingAndUsageSnapshot` records
             for each organization.
           - Persist progress: update `last_processed_org_id` in the run.
        4. If the task is killed or hits the time limit:
           - Partial progress (up to the last committed chunk) is safely stored.
           - On the next run, task resumes from where it stopped.
        5. After all organizations processed:
           - Delete stale snapshot rows (not updated in this run).
           - Refresh the `user_reports_mv` materialized view concurrently.
           - Mark the run as 'completed'.
    """
    calc = BillingAndUsageCalculator()
    cache_key = 'billing_and_usage_snapshot:run_lock'
    lock_timeout = settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT + 60
    lock = cache.lock(cache_key, timeout=lock_timeout)
    if not lock.acquire(blocking=False, blocking_timeout=0):
        logging.error('Task is already running')
        return

    # Claim the existing snapshot run or create a new one
    run = get_or_create_run()
    last_processed_org_id = run.last_processed_org_id or ''
    try:
        while chunk_qs := iter_org_chunks_after(last_processed_org_id):
            billing_map = get_current_billing_period_dates_by_org(chunk_qs)
            usage_map = calc.calculate_usage_batch(chunk_qs, billing_map)
            last_processed_org_id = process_chunk(chunk_qs, usage_map, run.pk)

            # Update the run progress
            BillingAndUsageSnapshotRun.objects.filter(pk=run.pk).update(
                last_processed_org_id=last_processed_org_id,
                date_modified=timezone.now(),
            )

        # All orgs processed: cleanup stale, refresh MV and mark run as completed
        cleanup_stale_snapshots_and_refresh_mv(run.pk)
        BillingAndUsageSnapshotRun.objects.filter(pk=run.pk).update(
            status=BillingAndUsageSnapshotStatus.COMPLETED,
            date_modified=timezone.now(),
        )

        # Release the lock
        lock.release()

    except Exception as ex:
        run = BillingAndUsageSnapshotRun.objects.get(pk=run.pk)
        details = run.details or {}
        details.update({'last_error': str(ex), 'ts': timezone.now().isoformat()})
        run.details = details
        run.save(update_fields=['details', 'date_modified'])
