from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone
from django_celery_beat.models import ClockedSchedule, PeriodicTask, PeriodicTasks

from kobo.apps.long_running_migrations.exceptions import (
    LongRunningMigrationDependencyError,
)
from kobo.apps.trash_bin.models.account import AccountTrash
from kobo.apps.trash_bin.models.attachment import AttachmentTrash
from kobo.apps.trash_bin.models.project import ProjectTrash
from kobo.apps.trash_bin.utils import temporarily_disconnect_signals
from kpi.utils.log import logging

CHUNK_SIZE = settings.LONG_RUNNING_MIGRATION_BATCH_SIZE

# Every task that the trash bin has scheduled with a `PeriodicTask`, including
# the paths that the tasks had before they moved to their own modules
TRASH_TASKS = (
    'kobo.apps.trash_bin.tasks.empty_account',
    'kobo.apps.trash_bin.tasks.empty_project',
    'kobo.apps.trash_bin.tasks.account.empty_account',
    'kobo.apps.trash_bin.tasks.attachment.empty_attachment',
    'kobo.apps.trash_bin.tasks.project.empty_project',
)

# Celery Beat keeps in memory the enabled clocked tasks that are due within the
# next 5 minutes, and saves a one-off task again after running it, to disable
# it. Deleting one of those tasks would make Beat insert it again, or fail on
# its missing `ClockedSchedule`, so they are left for a later run, once Beat has
# disabled them.
BEAT_SAFETY_MARGIN = timedelta(minutes=10)


def run():
    """
    Delete the `PeriodicTask`s and `ClockedSchedule`s that the trash bin used
    to schedule its deletions with.

    The trash bin no longer uses them: `task_restarter` sends the deletions
    once their retention has passed. The tasks that Celery Beat may still hold
    in memory are left in place, and the job raises to run again on the next
    cycle, until none is left.
    """

    deleted_tasks = _delete_trash_periodic_tasks()
    deleted_schedules = _delete_orphan_clocked_schedules()

    # The deletions above do not notify Celery Beat, to avoid one schedule
    # reload per batch. A single notification makes it reload once and drop
    # the deleted tasks.
    PeriodicTasks.update_changed()
    logging.info(
        f'[LRM 0033] deleted {deleted_tasks} periodic tasks and '
        f'{deleted_schedules} clocked schedules'
    )

    if remaining := PeriodicTask.objects.filter(task__in=TRASH_TASKS).count():
        raise LongRunningMigrationDependencyError(
            f'{remaining} trash periodic tasks may still be held by Celery Beat'
        )


def _delete_orphan_clocked_schedules() -> int:
    """
    Delete the `ClockedSchedule`s that no `PeriodicTask` uses anymore.
    """

    without_task = ~Exists(PeriodicTask.objects.filter(clocked_id=OuterRef('pk')))
    deleted = 0
    last_pk = 0
    while True:
        batch = list(
            ClockedSchedule.objects.filter(without_task, pk__gt=last_pk)
            .order_by('pk')
            .values_list('pk', flat=True)[:CHUNK_SIZE]
        )
        if not batch:
            break

        last_pk = batch[-1]
        with temporarily_disconnect_signals(delete=True):
            # Checked again, because deleting a schedule deletes the tasks
            # that use it, and another feature may have just created one
            ClockedSchedule.objects.filter(without_task, pk__in=batch).delete()
        deleted += len(batch)

    return deleted


def _delete_trash_periodic_tasks() -> int:
    """
    Detach the trash objects from their `PeriodicTask`s and delete them, except
    the ones that Celery Beat may hold in memory.
    """

    held_by_beat = Q(
        enabled=True,
        clocked__clocked_time__lte=timezone.now() + BEAT_SAFETY_MARGIN,
    )
    deleted = 0
    last_pk = 0
    while True:
        batch = list(
            PeriodicTask.objects.filter(task__in=TRASH_TASKS, pk__gt=last_pk)
            .exclude(held_by_beat)
            .order_by('pk')
            .values_list('pk', flat=True)[:CHUNK_SIZE]
        )
        if not batch:
            break

        last_pk = batch[-1]
        with temporarily_disconnect_signals(delete=True), transaction.atomic():
            # In the same transaction as the deletion, so that a trash object
            # that still points to one of these tasks cannot block it
            for model in (AccountTrash, ProjectTrash, AttachmentTrash):
                model.objects.filter(periodic_task_id__in=batch).update(
                    periodic_task=None
                )
            PeriodicTask.objects.filter(pk__in=batch).delete()
        deleted += len(batch)
        logging.info(f'[LRM 0033] deleted {deleted} periodic tasks')

    return deleted
