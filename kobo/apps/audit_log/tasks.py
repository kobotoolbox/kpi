from datetime import timedelta

from constance import config
from django.conf import settings
from django.utils import timezone
from more_itertools import chunked

from kobo.apps.audit_log.models import (
    AccessLog,
    AuditLog,
    ProjectHistoryLog,
)
from kobo.celery import celery_app
from kpi.utils.log import logging


@celery_app.task()
def batch_delete_audit_logs_by_id(ids):
    logs = AuditLog.objects.filter(id__in=ids)
    count, _ = logs.delete()
    logging.info(f'Deleted {count} audit logs from database')


def enqueue_logs_for_deletion(LogModel: AuditLog, log_lifespan: int):
    """Delete the logs for an audit log proxy model considering a lifespan
    given in number of days.

    Ids are batched into multiple tasks.
    """
    expiration_date = timezone.now() - timedelta(
        days=log_lifespan
    )

    expired_logs = (
        LogModel.objects.filter(date_created__lt=expiration_date)
        .values_list('id', flat=True)
        .iterator()
    )
    for id_batch in chunked(
        expired_logs, settings.LOG_DELETION_BATCH_SIZE
    ):
        # queue up a new task for each batch of expired ids
        batch_delete_audit_logs_by_id.delay(ids=id_batch)


@celery_app.task()
def spawn_logs_cleaning_tasks():
    """
    Enqueue tasks to delete logs older than the configured lifespan
    """
    enqueue_logs_for_deletion(AccessLog, config.ACCESS_LOG_LIFESPAN)
    enqueue_logs_for_deletion(ProjectHistoryLog, config.PROJECT_HISTORY_LOG_LIFESPAN)
