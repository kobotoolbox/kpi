import threading

from django.conf import settings
from django.core.cache import cache

from kobo.apps.user_reports.utils.tasks.refresh_user_report_snapshots import (
    advance_run,
    heartbeat,
    is_in_cooldown,
)
from kobo.celery import celery_app
from kpi.utils.log import logging

LOCK_KEY = 'billing_and_usage_snapshot:run_lock'


@celery_app.task(
    queue='kpi_long_running_tasks_queue',
    soft_time_limit=settings.CELERY_USER_REPORTS_SNAPSHOT_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_USER_REPORTS_SNAPSHOT_TIME_LIMIT,
)
def refresh_user_report_snapshots(**kwargs):
    """
    Refresh the `BillingAndUsageSnapshot` table, then the view built on it.

    A full pass over every organization outlives a single invocation, so
    the work is modelled as a run that successive invocations resume and
    eventually complete. See
    `kobo.apps.user_reports.utils.tasks.refresh_user_report_snapshots` for
    how a pass advances and how concurrent workers are kept apart.
    """
    if is_in_cooldown():
        return

    lock = cache.lock(
        LOCK_KEY,
        timeout=settings.CELERY_HEARTBEAT_LOCK_TTL,
        # The heartbeat thread extends this same lock, so it must share its
        # ownership token with this one instead of getting its own.
        thread_local=False,
    )
    if not lock.acquire(blocking=False):
        logging.info('[Refresh MV]: Nothing to do, task is already running!')
        return

    logging.info('[Refresh MV]: Starting process')
    stop_event = threading.Event()
    heartbeat_thread = threading.Thread(
        target=heartbeat, args=(stop_event, lock), daemon=True
    )
    heartbeat_thread.start()
    try:
        advance_run()
    except Exception as ex:
        logging.error(f'[Refresh MV]: Failed before a run could be claimed: {ex}')
    finally:
        stop_event.set()
        heartbeat_thread.join(timeout=5)
        # `release()` checks ownership server-side and raises instead of
        # deleting someone else's lock, so it needs no guard of its own - it
        # just must not raise out of `finally`.
        try:
            lock.release()
            logging.info('[Refresh MV]: Lock released!')
        except Exception as ex:
            logging.warning(f'[Refresh MV]: Lock was not released: {ex}')
