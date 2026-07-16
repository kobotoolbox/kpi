import threading

from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.core.cache import cache
from django.db import close_old_connections
from django.db.models import Q
from django.utils import timezone

from kobo.celery import celery_app
from kpi.utils.log import logging
from .models import LongRunningMigration, LongRunningMigrationStatus


@celery_app.task(
    queue='kpi_long_running_tasks_queue',
    soft_time_limit=settings.CELERY_LONG_RUNNING_MIGRATION_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_LONG_RUNNING_MIGRATION_TASK_TIME_LIMIT,
)
def async_execute(migration_id: int):
    migration = LongRunningMigration.objects.get(pk=migration_id)
    lock_key = f'execute_long_running_migrations:{migration.name}'
    if cache.add(
        lock_key,
        'true',
        timeout=settings.CELERY_LONG_RUNNING_MIGRATION_TASK_HEARTBEAT_TTL,
    ):
        stop_event = threading.Event()
        heartbeat = threading.Thread(
            target=_heartbeat,
            args=(stop_event, lock_key, migration_id),
            daemon=True,
        )
        heartbeat.start()
        try:
            migration.execute()
        finally:
            stop_event.set()
            heartbeat.join(timeout=5)
            cache.delete(lock_key)


@celery_app.task(queue='kpi_long_running_tasks_queue')
def execute_long_running_migrations():
    # Adding an offset to account for potential delays in task execution and
    # clock drift between the Celery workers and the database, ensuring tasks
    # are not prematurely re-dispatched.
    offset = 5 * 60
    # A running migration refreshes `date_modified` on every heartbeat, so a
    # stale timestamp means the worker died (e.g. a Kubernetes pod eviction)
    # without releasing its lock. We base the re-dispatch on the short heartbeat
    # TTL instead of the full task time limit, so a dead migration is retried
    # within minutes instead of hours.
    task_expiry_time = timezone.now() - relativedelta(
        seconds=settings.CELERY_LONG_RUNNING_MIGRATION_TASK_HEARTBEAT_TTL + offset
    )
    # Run tasks that were just created or are in progress but whose worker died
    # without refreshing the heartbeat.
    for migration in LongRunningMigration.objects.filter(
        Q(status=LongRunningMigrationStatus.CREATED)
        | Q(status=LongRunningMigrationStatus.IN_PROGRESS)
        & Q(date_modified__lte=task_expiry_time)
    ).order_by('date_created'):
        async_execute.delay(migration.pk)


def _heartbeat(stop_event: threading.Event, lock_key: str, migration_id: int):
    """
    Keep the migration's lock and `date_modified` fresh while it runs.

    Runs in a background thread so migration jobs never have to call anything
    themselves (a job author cannot forget it). Refreshing the lock with a short
    TTL - instead of holding it for the whole task time limit - means a
    hard-killed worker releases the lock within a few heartbeats rather than
    blocking re-execution for hours. Bumping `date_modified` lets
    `execute_long_running_migrations` tell a live task apart from a dead one.
    """

    interval = settings.CELERY_LONG_RUNNING_MIGRATION_TASK_HEARTBEAT_INTERVAL
    ttl = settings.CELERY_LONG_RUNNING_MIGRATION_TASK_HEARTBEAT_TTL
    while not stop_event.wait(interval):
        # Recycle any connection that outlived `CONN_MAX_AGE` or was dropped
        # server-side: over a 24h lifetime a persistent connection cannot be
        # trusted, and a broken one would fail every subsequent heartbeat.
        close_old_connections()
        try:
            cache.set(lock_key, 'true', timeout=ttl)
            LongRunningMigration.objects.filter(pk=migration_id).update(
                date_modified=timezone.now()
            )
        except Exception as e:
            # A failed DB write is harmless: the lock is still refreshed, so a
            # premature re-dispatch is blocked by `cache.add`. A failed cache
            # write is worse: the lock can expire and the migration may run a
            # second time in parallel. We accept that because migrations are
            # written to be safe to re-run. Either way, never let one bad
            # iteration kill the heartbeat.
            logging.warning(
                f'LongRunningMigration #{migration_id} heartbeat failed: {e}'
            )

    # Release this thread's connection on exit.
    close_old_connections()
