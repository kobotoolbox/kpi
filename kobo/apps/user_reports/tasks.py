from uuid import uuid4

from celery.exceptions import SoftTimeLimitExceeded
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from kobo.apps.user_reports.exceptions import RunTakenOver
from kobo.apps.user_reports.models import BillingAndUsageSnapshotRun
from kobo.apps.user_reports.utils.tasks import (
    refresh_user_report_snapshots as snapshot_utils,
)
from kobo.celery import celery_app
from kpi.utils.django_orm_helper import UpdateJSONFieldAttributes
from kpi.utils.log import logging

LOCK_KEY = 'billing_and_usage_snapshot:run_lock'


@celery_app.task(
    queue='kpi_long_running_tasks_queue',
    soft_time_limit=settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT,
)
def refresh_user_report_snapshots(**kwargs):
    """
    Refresh the `BillingAndUsageSnapshot` table, then the view built on it.

    A full pass over every organization can outlive a single invocation, so
    the work is modelled as a run that successive invocations resume and
    eventually complete. See
    `kobo.apps.user_reports.utils.tasks.refresh_user_report_snapshots` for
    the building blocks used below and how concurrent workers are kept
    apart.
    """
    if snapshot_utils.is_in_cooldown():
        return

    lock = cache.lock(LOCK_KEY, timeout=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT)
    if not lock.acquire(blocking=False):
        logging.info('[Refresh MV]: Nothing to do, task is already running!')
        return

    logging.info('[Refresh MV]: Starting process')
    try:
        run = snapshot_utils.get_or_create_run()
        # Only its view refresh is outstanding: every organization was
        # already processed, so this invocation just retries refreshing
        # the view.
        view_only = bool(run.details.get('mv_refresh_failed'))

        # Claim the run by stamping this invocation's token on it. Reading
        # it back is never needed: the token travels inside the `WHERE` of
        # every write below, so ownership cannot go stale between a check
        # and the write it guards.
        owner_token = str(uuid4())
        BillingAndUsageSnapshotRun.objects.filter(pk=run.pk).update(
            details=UpdateJSONFieldAttributes(
                'details', updates={'owner_token': owner_token}
            ),
            date_modified=timezone.now(),
        )

        try:
            if not view_only:
                snapshot_utils.process_organizations(run, owner_token)
            snapshot_utils.complete_run(run, owner_token)
        except RunTakenOver:
            logging.warning(
                f'[Refresh MV]: Run claimed by another worker (#{run.uid}), '
                'leaving it to whoever owns it now'
            )
        except SoftTimeLimitExceeded:
            # Expected: a pass routinely outlives one invocation. Refresh
            # with what was processed so far - the next invocation resumes
            # from the cursor.
            logging.info(
                f'[Refresh MV]: Time limit reached (#{run.uid}), resuming next time'
            )
            snapshot_utils.refresh_view(run, owner_token)
        except Exception as ex:
            logging.error(f'[Refresh MV]: Run failed (#{run.uid}): {ex}')
            snapshot_utils.owned_run(run.pk, owner_token).update(
                details=UpdateJSONFieldAttributes(
                    'details',
                    updates={'last_error': str(ex), 'ts': timezone.now().isoformat()},
                ),
                date_modified=timezone.now(),
            )
            # Partial progress is still progress, so refresh with it rather
            # than leave the view untouched until a whole pass succeeds.
            snapshot_utils.refresh_view(run, owner_token)
    except Exception as ex:
        logging.error(f'[Refresh MV]: Failed before a run could be claimed: {ex}')
    finally:
        # `release()` checks ownership server-side and raises instead of
        # deleting someone else's lock (e.g. if this one's TTL already
        # expired and a replacement worker has since acquired it) - it just
        # must not raise out of `finally`.
        try:
            lock.release()
            logging.info('[Refresh MV]: Lock released!')
        except Exception as ex:
            logging.warning(f'[Refresh MV]: Lock was not released: {ex}')
