from datetime import timedelta

from celery import Task
from constance import config
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django_celery_beat.models import ClockedSchedule, PeriodicTask

from kobo.celery import celery_app
from kpi.utils.log import logging
from ..constants import (
    DELETE_ATTACHMENT_STR_PREFIX,
    DELETE_PROJECT_STR_PREFIX,
    DELETE_USER_STR_PREFIX,
)
from ..models import TrashStatus
from ..models.account import AccountTrash
from ..models.attachment import AttachmentTrash
from ..models.project import ProjectTrash
from ..type_aliases import TrashBinModel
from ..utils import temporarily_disconnect_signals
from .account import empty_account
from .attachment import empty_attachment
from .project import empty_project


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
    e.g.: docker container/k8s pod restart or OOM killed, and the ones which
    failed on a transient (infrastructure) error
    """

    for model, task, retention in (
        (AccountTrash, empty_account, config.ACCOUNT_TRASH_RETENTION),
        (ProjectTrash, empty_project, config.PROJECT_TRASH_RETENTION),
        (AttachmentTrash, empty_attachment, config.ATTACHMENT_TRASH_RETENTION),
    ):
        _restart_stuck_tasks(model, task, retention)


def _restart_stuck_tasks(model: TrashBinModel, task: Task, retention: int):
    """
    Restart tasks which have been stopped accidentally, i.e.: they are still
    flagged as pending or in progress but nothing has updated them for a while

    Tasks which failed on a transient (infrastructure) error are deliberately
    left in progress by `trash_bin_task_failure()`, so they are picked up here
    as well
    """
    pending_grace_period = timezone.now() - timedelta(days=retention)
    stuck_threshold = timezone.now() - timedelta(
        seconds=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT + 60 * 5
    )

    # A deletion which has already started has, by definition, passed its
    # scheduled time: looking at the clocked time again would only delay its
    # restart by a whole retention period and that time is set in the past
    # when the object is trashed manually anyway
    started_objects = Q(status=TrashStatus.IN_PROGRESS)

    # Objects which never started must wait for their scheduled time, and the
    # ones waiting for a superuser to empty them manually must never be started
    # automatically
    due_objects = Q(
        empty_manually=False,
        status=TrashStatus.PENDING,
        periodic_task__clocked__clocked_time__lte=pending_grace_period,
    )

    stuck_objects = (
        model.objects.values_list('pk', 'date_modified')
        .filter(
            started_objects | due_objects,
            date_modified__lte=stuck_threshold,
        )
        .order_by('date_modified')[:settings.MAX_RESTARTED_TASKS]
    )

    for stuck_id, date_modified in stuck_objects:
        # Claim the object, otherwise the next run would enqueue it again while
        # its restart is still waiting in the queue. And both would force the
        # deletion, i.e.: run the destructive workflow at the same time. The
        # update is conditional, so that two overlapping runs cannot both claim
        # the same object
        claimed_at = timezone.now()
        claimed = model.objects.filter(
            pk=stuck_id, date_modified__lte=stuck_threshold
        ).update(date_modified=claimed_at)
        if not claimed:
            continue

        try:
            task.delay(stuck_id, force=True)
        except Exception:
            # If the task fails to enqueue, restore the original date_modified
            # so that it can be picked up again in the next run, and carry on
            # with the rest of the batch instead of holding it back too
            model.objects.filter(pk=stuck_id, date_modified=claimed_at).update(
                date_modified=date_modified
            )
            logging.exception(f'Could not restart {model.__name__} #{stuck_id}')
