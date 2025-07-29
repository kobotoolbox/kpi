from datetime import timedelta

from constance import config
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django_celery_beat.models import ClockedSchedule, PeriodicTask

from kobo.celery import celery_app
from .account import empty_account
from .attachment import empty_attachment
from .project import empty_project
from ..constants import (
    DELETE_ATTACHMENT_STR_PREFIX,
    DELETE_PROJECT_STR_PREFIX,
    DELETE_USER_STR_PREFIX,
)
from ..models import TrashStatus
from ..models.account import AccountTrash
from ..models.attachment import AttachmentTrash
from ..models.project import ProjectTrash
from ..utils import temporarily_disconnect_signals


@celery_app.task
def garbage_collector():

    with temporarily_disconnect_signals(delete=True):
        with transaction.atomic():
            # Remove orphan periodic tasks
            PeriodicTask.objects.exclude(
                pk__in=AccountTrash.objects.values_list('periodic_task_id', flat=True),
            ).filter(
                name__startswith=DELETE_USER_STR_PREFIX, clocked__isnull=False
            ).delete()

            PeriodicTask.objects.exclude(
                pk__in=ProjectTrash.objects.values_list('periodic_task_id', flat=True),
            ).filter(
                name__startswith=DELETE_PROJECT_STR_PREFIX, clocked__isnull=False
            ).delete()

            PeriodicTask.objects.exclude(
                pk__in=AttachmentTrash.objects.values_list(
                    'periodic_task_id', flat=True
                ),
            ).filter(
                name__startswith=DELETE_ATTACHMENT_STR_PREFIX,
                clocked__isnull=False,
            ).delete()

            # Then, remove clocked schedules
            ClockedSchedule.objects.exclude(
                pk__in=PeriodicTask.objects.filter(clocked__isnull=False).values_list(
                    'clocked_id', flat=True
                ),
            ).delete()


@celery_app.task
def task_restarter():
    """
    This task restarts previous tasks which have been stopped accidentally,
    e.g.: docker container/k8s pod restart or OOM killed.
    """

    # 1) Restart account deletion tasks
    pending_grace_period = timezone.now() - timedelta(
        days=config.ACCOUNT_TRASH_GRACE_PERIOD
    )
    stuck_threshold = timezone.now() - timedelta(
        seconds=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT + 60 * 5
    )

    stuck_account_ids = (
        AccountTrash.objects.values_list('pk', flat=True)
        .filter(
            status__in=[TrashStatus.PENDING, TrashStatus.IN_PROGRESS],
            date_modified__lte=stuck_threshold,
            periodic_task__clocked__clocked_time__lte=pending_grace_period,
        )
        .order_by('date_modified')[:settings.MAX_RESTARTED_TASKS]
    )
    for stuck_account_id in stuck_account_ids:
        empty_account.delay(stuck_account_id, force=True)

    # 2) Restart project deletion tasks
    pending_grace_period = timezone.now() - timedelta(
        days=config.PROJECT_TRASH_GRACE_PERIOD
    )
    stuck_project_ids = (
        ProjectTrash.objects.values_list('pk', flat=True)
        .filter(
            status__in=[TrashStatus.PENDING, TrashStatus.IN_PROGRESS],
            date_modified__lte=stuck_threshold,
            periodic_task__clocked__clocked_time__lte=pending_grace_period,
        )
        .order_by('date_modified')[:settings.MAX_RESTARTED_TASKS]
    )
    for stuck_project_id in stuck_project_ids:
        empty_project.delay(stuck_project_id, force=True)

    # 3) Restart attachment deletion tasks
    pending_grace_period = timezone.now() - timedelta(
        days=config.ATTACHMENT_TRASH_GRACE_PERIOD
    )
    stuck_attachment_ids = AttachmentTrash.objects.values_list(
        'pk', flat=True
    ).filter(
        status__in=[TrashStatus.PENDING, TrashStatus.IN_PROGRESS],
        date_modified__lte=stuck_threshold,
        periodic_task__clocked__clocked_time__lte=pending_grace_period,
    ).order_by('date_modified')[:settings.MAX_RESTARTED_TASKS]

    for stuck_attachment_id in stuck_attachment_ids:
        empty_attachment.delay(stuck_attachment_id, force=True)
