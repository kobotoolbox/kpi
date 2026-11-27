from datetime import timedelta

from celery import Task
from celery.exceptions import SoftTimeLimitExceeded
from constance import config
from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from kobo.celery import celery_app
from kpi.utils.log import logging
from ..models import TrashStatus
from ..models.account import AccountTrash
from ..models.attachment import AttachmentTrash
from ..models.project import ProjectTrash
from ..type_aliases import TrashBinModel
from .account import empty_account
from .attachment import empty_attachment
from .project import empty_project


@celery_app.task
def garbage_collector():
    """
    Do nothing.

    Kept for one release, so that the messages that are still in the queues
    do not fail. `task_restarter` sends the deletion of trashed objects, and the
    long-running migration that removes trash `PeriodicTask`s deletes the
    remaining ones.
    """


@celery_app.task
def task_restarter():
    """
    This task sends the deletion of trashed objects once their retention has
    passed, and restarts previous tasks which have been stopped accidentally,
    e.g.: docker container/k8s pod restart or OOM killed, and the ones which
    failed on a transient (infrastructure) error
    """

    for model, task, retention, max_restarts in (
        (
            AccountTrash,
            empty_account,
            config.ACCOUNT_TRASH_RETENTION,
            settings.MAX_RESTARTED_ACCOUNT_DELETIONS,
        ),
        (
            ProjectTrash,
            empty_project,
            config.PROJECT_TRASH_RETENTION,
            settings.MAX_RESTARTED_PROJECT_DELETIONS,
        ),
        (
            AttachmentTrash,
            empty_attachment,
            config.ATTACHMENT_TRASH_RETENTION,
            settings.MAX_RESTARTED_ATTACHMENT_DELETIONS,
        ),
    ):
        _restart_stuck_tasks(model, task, retention, max_restarts)


def _restart_stuck_tasks(
    model: TrashBinModel, task: Task, retention: int, max_restarts: int
):
    """
    Send the deletion of objects whose retention has passed, and restart tasks
    which have been stopped accidentally, i.e.: they are still flagged as in
    progress but nothing has updated them for a while

    Tasks which failed on a transient (infrastructure) error are deliberately
    left in progress by `trash_bin_task_failure()`, so they are picked up here
    as well
    """
    stuck_threshold = timezone.now() - timedelta(
        seconds=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT + 60 * 5
    )

    # A deletion which has already started has, by definition, passed its
    # retention. Such objects are few: the least recently updated go first
    stuck_objects = list(
        model.objects.values_list('pk', 'date_modified')
        .filter(status=TrashStatus.IN_PROGRESS, date_modified__lte=stuck_threshold)
        .order_by('date_modified')[:max_restarts]
    )

    # Objects which never started follow the same rules as `scheduled_time` on
    # the trash models. They must wait for their retention, read from Constance
    # on every run, and the ones waiting for a superuser to empty them manually,
    # or whose retention is -1, must never be started automatically
    due_objects = Q()
    if retention >= 0:
        retention_threshold = timezone.now() - timedelta(days=retention)
        due_objects |= Q(date_created__lte=retention_threshold)

    # Accounts trashed without a placeholder are due right away: their deletion
    # is sent when they are trashed, and this only catches a lost message
    if model is AccountTrash:
        due_objects |= Q(retain_placeholder=False)

    remaining = max_restarts - len(stuck_objects)
    if due_objects and remaining > 0:
        # Oldest first: on a large table, the index on `date_created` reads
        # nothing until objects are due, then about `remaining` rows. The
        # filter on `date_modified` skips the objects whose deletion has
        # already been sent (see the claim below)
        stuck_objects += list(
            model.objects.values_list('pk', 'date_modified')
            .filter(
                due_objects,
                empty_manually=False,
                status=TrashStatus.PENDING,
                date_modified__lte=stuck_threshold,
            )
            .order_by('date_created')[:remaining]
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
        except SoftTimeLimitExceeded:
            # `task_restarter` itself is running out of time, the object is not
            # at fault: release the claim so the next run picks it up, and let
            # the exception bubble up instead of logging a misleading failure
            model.objects.filter(pk=stuck_id, date_modified=claimed_at).update(
                date_modified=date_modified
            )
            raise
        except Exception:
            # If the task fails to enqueue, restore the original date_modified
            # so that it can be picked up again in the next run, and carry on
            # with the rest of the batch instead of holding it back too
            model.objects.filter(pk=stuck_id, date_modified=claimed_at).update(
                date_modified=date_modified
            )
            logging.exception(f'Could not restart {model.__name__} #{stuck_id}')
