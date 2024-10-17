from datetime import timedelta

from constance import config
from django.conf import settings
from django.utils import timezone
from more_itertools import chunked

from kobo.apps.audit_log.models import (
    AccessLog,
    AuditLog,
)
from kobo.celery import celery_app
from kpi.utils.log import logging


@celery_app.task()
def spawn_access_log_cleaning_tasks():
    """
    Enqueue tasks to delete access logs older than ACCESS_LOG_LIFESPAN days old.

    ACCESS_LOG_LIFESPAN is configured via constance.
    Ids are batched into multiple tasks.
    """

    expiration_date = timezone.now() - timedelta(
        days=config.ACCESS_LOG_LIFESPAN
    )

    expired_logs = (
        AccessLog.objects.filter(date_created__lt=expiration_date)
        .values_list('id', flat=True)
        .iterator()
    )
    for id_batch in chunked(
        expired_logs, settings.ACCESS_LOG_DELETION_BATCH_SIZE
    ):
        # queue up a new task for each batch of expired ids
        batch_delete_audit_logs_by_id.delay(ids=id_batch)


@celery_app.task()
def batch_delete_audit_logs_by_id(ids):
    logs = AuditLog.objects.filter(id__in=ids)
    count, _ = logs.delete()
    logging.info(f'Deleted {count} audit logs from database')
