from datetime import timedelta

from constance import config
from django.db.models import Q
from django.utils import timezone
from more_itertools import chunked

from kobo.apps.audit_log.models import AuditLog, AuditType
from kobo.celery import celery_app
from kpi.constants import SUBMISSION_GROUP_AUTH_TYPE
from kpi.utils.log import logging
from django.conf import settings




@celery_app.task()
def spawn_access_log_cleaning_tasks():
    """
    Enqueue tasks to delete access logs older than ACCESS_LOG_LIFESPAN days old, in batches

    ACCESS_LOG_LIFESPAN is configured via constance
    """

    expiration_date = timezone.now() - timedelta(
        days=config.ACCESS_LOG_LIFESPAN
    )
    # submission-groups expire when their newest entry expires
    group_submission_logs = Q(log_type=AuditType.ACCESS, metadata__auth_type=SUBMISSION_GROUP_AUTH_TYPE)
    expired_group_submission_logs = group_submission_logs & Q(metadata__latest_entry__lt=expiration_date)
    # non-submission-group logs expire when they were created > ACCESS_LOG_LIFESPAN days ago
    expired_other_logs = Q(log_type=AuditType.ACCESS, date_created__lt=expiration_date) & ~group_submission_logs
    expired_logs = (
        AuditLog.objects.filter(
            expired_group_submission_logs | expired_other_logs
        )
        .values_list('id', flat=True)
        .iterator()
    )
    for id_batch in chunked(expired_logs, settings.ACCESS_LOG_DELETION_BATCH_SIZE):
        # queue up a new task for each batch ids
        batch_delete_audit_logs_by_id.delay(ids=id_batch)


@celery_app.task()
def batch_delete_audit_logs_by_id(ids):
    logs = AuditLog.objects.filter(id__in=ids)
    logs.delete()
    logging.info(f'Deleted {len(logs)} audit logs from database')
