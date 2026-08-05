import random
from datetime import timedelta

from celery import Task
from constance import config
from django.conf import settings
from django.db import transaction
from django.db.models import IntegerField, Q, Value
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast, Coalesce
from django.utils import timezone
from django_celery_beat.models import ClockedSchedule, PeriodicTask

from kobo.celery import celery_app
from ..constants import (
    DELETE_ATTACHMENT_STR_PREFIX,
    DELETE_PROJECT_STR_PREFIX,
    DELETE_USER_STR_PREFIX,
    RETRYABLE_FAILURE_PATTERNS,
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
        _restart_failed_tasks(model, task)


def _restart_failed_tasks(model: TrashBinModel, task: Task):
    """
    Restart tasks which failed on an error that is caused by the infrastructure
    and not by the data being deleted

    Each attempt is counted in `metadata['retryable_failure_count']` and the
    object is left alone, i.e.: it requires manual intervention after
    `settings.TRASH_BIN_MAX_AUTO_RESTARTS` attempts
    """
    cooldown = timezone.now() - timedelta(
        seconds=settings.TRASH_BIN_AUTO_RESTART_COOLDOWN
    )

    # Must stay case-insensitive, just like `is_retryable_failure()`: an object
    # selected here but ignored there would be restarted over and over without
    # its counter ever being incremented.
    # `__contains` cannot be used, it means JSON containment - i.e.: equality
    # for strings - and not a substring match
    retryable_errors = Q()
    for pattern in RETRYABLE_FAILURE_PATTERNS:
        retryable_errors |= Q(metadata__failure_error__icontains=pattern)

    failed_ids = (
        model.objects.annotate(
            # `metadata__retryable_failure_count__lte` would compare two JSON
            # values instead of two integers, and would silently discard the
            # objects which failed before this counter existed
            restart_count=Coalesce(
                Cast(
                    KeyTextTransform('retryable_failure_count', 'metadata'),
                    IntegerField(),
                ),
                Value(0),
            ),
        )
        .filter(
            retryable_errors,
            status=TrashStatus.FAILED,
            date_modified__lte=cooldown,
            restart_count__lte=settings.TRASH_BIN_MAX_AUTO_RESTARTS,
        )
        .values_list('pk', flat=True)
        .order_by('date_modified')[:settings.MAX_RESTARTED_TASKS]
    )

    for failed_id in failed_ids:
        # Spread the restarts over time, so that tasks which deadlocked against
        # each other do not collide again as soon as they are restarted
        task.apply_async(
            args=[failed_id],
            kwargs={'force': True},
            countdown=random.randint(0, settings.TRASH_BIN_AUTO_RESTART_JITTER),
        )


def _restart_stuck_tasks(model: TrashBinModel, task: Task, retention: int):
    """
    Restart tasks which have been stopped accidentally, i.e.: they are still
    flagged as pending or in progress but nothing has updated them for a while
    """
    pending_grace_period = timezone.now() - timedelta(days=retention)
    stuck_threshold = timezone.now() - timedelta(
        seconds=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT + 60 * 5
    )

    # Objects waiting for a superuser to empty them manually must never be
    # started automatically. Once a superuser has started one, it becomes a
    # stuck task like any other - and its clocked time, which is set in the past
    # when it is trashed and never represented a real schedule, must not decide
    # whether it is restarted
    manually_started_objects = Q(
        empty_manually=True, status=TrashStatus.IN_PROGRESS
    )
    scheduled_and_due_objects = Q(
        empty_manually=False,
        status__in=[TrashStatus.PENDING, TrashStatus.IN_PROGRESS],
        periodic_task__clocked__clocked_time__lte=pending_grace_period,
    )

    stuck_ids = (
        model.objects.values_list('pk', flat=True)
        .filter(
            manually_started_objects | scheduled_and_due_objects,
            date_modified__lte=stuck_threshold,
        )
        .order_by('date_modified')[:settings.MAX_RESTARTED_TASKS]
    )

    for stuck_id in stuck_ids:
        task.delay(stuck_id, force=True)
