from kobo.celery import celery_app

from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from django.utils import timezone
from dateutil.relativedelta import relativedelta

from .models import LongRunningMigration, LongRunningMigrationStatus


@celery_app.task(
    queue='kpi_low_priority_queue',
    soft_time_limit=settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT,
)
def execute_long_running_migrations():
    lock_key = 'execute_long_running_migrations'

    if cache.add(
        lock_key, 'true', timeout=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT
    ):
        try:
            # Adding an offset to account for potential delays in task execution and
            # clock drift between the Celery workers and the database, ensuring tasks
            # are not prematurely skipped.
            offset = 5 * 60
            task_expiry_time = timezone.now() - relativedelta(
                seconds=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT + offset
            )
            # Run tasks that were just created or are in progress but have exceeded
            # the maximum runtime allowed for a Celery task, causing Celery to terminate
            # them and raise a SoftTimeLimitExceeded exception.
            for migration in LongRunningMigration.objects.filter(
                Q(status=LongRunningMigrationStatus.CREATED)
                | Q(status=LongRunningMigrationStatus.IN_PROGRESS)
                & Q(date_modified__lte=task_expiry_time)
            ).order_by('date_created'):
                migration.execute()
        finally:
            cache.delete(lock_key)
