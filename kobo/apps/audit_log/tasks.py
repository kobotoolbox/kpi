from datetime import timedelta

from constance import config
from django.utils import timezone
from more_itertools import chunked

from kobo.apps.audit_log.models import AuditLog, AuditType
from kobo.celery import celery_app
from kpi.utils.log import logging

BATCH_SIZE = 1000


@celery_app.task()
def spawn_access_log_cleaning_tasks():
    """
    Enqueue tasks to delete access logs older than ACCESS_LOG_LIFESPAN (in days) in batches

    ACCESS_LOG_LIFESPAN is configured via constance
    """

    expiration_date = timezone.now() - timedelta(
        days=config.ACCESS_LOG_LIFESPAN
    )
    expired_logs = (
        AuditLog.objects.filter(
            log_type=AuditType.ACCESS, date_created__lt=expiration_date
        )
        .values_list('id', flat=True)
        .iterator()
    )
    for id_batch in chunked(expired_logs, BATCH_SIZE):
        batch_delete_audit_logs_by_id.delay(ids=id_batch)


@celery_app.task()
def batch_delete_audit_logs_by_id(ids):
    logs = AuditLog.objects.filter(id__in=ids)
    logs.delete()
    logging.info(f'Deleted {len(logs)} audit logs from database')
