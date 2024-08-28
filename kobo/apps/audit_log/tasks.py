from datetime import timedelta

from constance import config
from django.conf import settings
from django.db.models import Count, Q
from django.utils import timezone
from more_itertools import chunked

from kobo.apps.audit_log.models import (
    AccessLog,
    AuditLog,
    SubmissionAccessLog,
    SubmissionGroup,
)
from kobo.celery import celery_app
from kpi.constants import ACCESS_LOG_SUBMISSION_GROUP_AUTH_TYPE
from kpi.utils.log import logging


def remove_expired_submissions_from_groups(expiration_date):
    expired_submissions = SubmissionAccessLog.objects.filter(
        date_created__lt=expiration_date
    )
    for submission in expired_submissions:
        submission.submission_group = None
    SubmissionAccessLog.objects.bulk_update(
        expired_submissions, fields=['submission_group'], batch_size=100
    )


def get_empty_submission_group_ids():
    # (groups will still contain themselves, so check for groups with only one "submission")
    return (
        SubmissionGroup.objects.annotate(Count('submissions'))
        .filter(submissions__count=1)
        .values_list('id', flat=True)
        .iterator()
    )


@celery_app.task()
def spawn_access_log_cleaning_tasks():
    """
    Enqueue tasks to delete access logs older than ACCESS_LOG_LIFESPAN days old, in batches

    ACCESS_LOG_LIFESPAN is configured via constance
    """

    expiration_date = timezone.now() - timedelta(
        days=config.ACCESS_LOG_LIFESPAN
    )
    # step 1: remove expired submissions from groups
    remove_expired_submissions_from_groups(expiration_date)

    # step 2: remove empty submission groups
    empty_submission_groups = get_empty_submission_group_ids()
    for group_batch in chunked(
        empty_submission_groups, settings.ACCESS_LOG_DELETION_BATCH_SIZE
    ):
        batch_delete_audit_logs_by_id.delay(ids=group_batch)

    # step 3: delete everything else that is > ACCESS_LOG_LIFESPAN days ago
    expired_logs = (
        # .exclude works funny with jsonfields, so use Q instead to exclude submission groups
        # (need to explicitly include cases where the auth_type is null. It shouldn't happen
        # outside of tests, but we should handle it anyway)
        AccessLog.objects.filter(
            Q(date_created__lt=expiration_date)
            & (
                ~Q(metadata__auth_type=ACCESS_LOG_SUBMISSION_GROUP_AUTH_TYPE)
                | Q(metadata__auth_type__isnull=True)
            )
        )
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
