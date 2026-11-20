import importlib
import json
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from django_celery_beat.models import ClockedSchedule, PeriodicTask

from kobo.apps.long_running_migrations.exceptions import (
    LongRunningMigrationDependencyError,
)
from kobo.apps.trash_bin.models.account import AccountTrash
from kobo.apps.trash_bin.utils import move_to_trash

job_0033 = importlib.import_module(
    'kobo.apps.long_running_migrations.jobs.0033_delete_trash_periodic_tasks'
)

EMPTY_ACCOUNT_TASK = 'kobo.apps.trash_bin.tasks.account.empty_account'


class DeleteTrashPeriodicTasksTestCase(TestCase):
    """
    The job must delete the trash `PeriodicTask`s and their `ClockedSchedule`s,
    except the ones that Celery Beat may hold in memory, and leave every other
    task untouched
    """

    fixtures = ['test_data']

    def setUp(self):
        self.admin = get_user_model().objects.get(username='adminuser')
        self.someuser = get_user_model().objects.get(username='someuser')
        self.anotheruser = get_user_model().objects.get(username='anotheruser')

    def test_run_deletes_trash_tasks_and_keeps_other_tasks(self):
        account_trash = self._move_account_to_trash(self.someuser)
        trash_task = self._attach_task(account_trash, days=30, enabled=True)
        # A task scheduled with the path that the trash tasks used to have
        legacy_task = self._create_task(
            'kobo.apps.trash_bin.tasks.empty_project', days=-3, enabled=False
        )
        other_task = self._create_task('kpi.tasks.other', days=30, enabled=True)
        trash_count = AccountTrash.objects.count()

        job_0033.run()

        # Trash objects are only detached from their tasks, never deleted
        assert AccountTrash.objects.count() == trash_count

        account_trash.refresh_from_db()
        assert account_trash.periodic_task_id is None
        assert not PeriodicTask.objects.filter(
            pk__in=[trash_task.pk, legacy_task.pk]
        ).exists()
        assert not ClockedSchedule.objects.filter(
            pk__in=[trash_task.clocked_id, legacy_task.clocked_id]
        ).exists()
        assert PeriodicTask.objects.filter(pk=other_task.pk).exists()
        assert ClockedSchedule.objects.filter(pk=other_task.clocked_id).exists()

    def test_run_leaves_tasks_held_by_beat_for_a_later_run(self):
        held_trash = self._move_account_to_trash(self.someuser)
        held_task = self._attach_task(held_trash, days=-1, enabled=True)
        # Disabled: Celery Beat does not hold it, even though it is due
        disabled_trash = self._move_account_to_trash(self.anotheruser)
        disabled_task = self._attach_task(disabled_trash, days=-1, enabled=False)
        trash_count = AccountTrash.objects.count()

        with pytest.raises(LongRunningMigrationDependencyError):
            job_0033.run()

        # Trash objects are only detached from their tasks, never deleted
        assert AccountTrash.objects.count() == trash_count

        held_trash.refresh_from_db()
        assert held_trash.periodic_task_id == held_task.pk
        assert ClockedSchedule.objects.filter(pk=held_task.clocked_id).exists()
        assert not PeriodicTask.objects.filter(pk=disabled_task.pk).exists()

        # Celery Beat runs the task and disables it, the next run finishes
        PeriodicTask.objects.filter(pk=held_task.pk).update(enabled=False)
        job_0033.run()

        assert AccountTrash.objects.count() == trash_count

        held_trash.refresh_from_db()
        assert held_trash.periodic_task_id is None
        assert not PeriodicTask.objects.filter(pk=held_task.pk).exists()

    def test_run_protects_tasks_that_come_due_while_it_runs(self):
        """
        The window of the tasks that Celery Beat may hold moves with time, so a
        task that comes due while the job runs must be left in place too
        """
        start = timezone.now()
        early_trash = self._move_account_to_trash(self.someuser)
        early_task = self._attach_task(early_trash, days=30, enabled=True)
        late_trash = self._move_account_to_trash(self.anotheruser)
        late_task = self._attach_task(late_trash, days=0, enabled=True)
        ClockedSchedule.objects.filter(pk=late_task.clocked_id).update(
            clocked_time=start + timedelta(minutes=12)
        )

        # One task per batch, and 5 minutes pass between the two batches: the
        # second one must see the task due at +12 minutes as held by Beat
        cutoffs = iter(
            [start + timedelta(minutes=10)] + [start + timedelta(minutes=15)] * 3
        )
        with patch.object(job_0033, 'CHUNK_SIZE', 1), patch.object(
            job_0033, '_get_beat_cutoff', side_effect=lambda: next(cutoffs)
        ):
            with pytest.raises(LongRunningMigrationDependencyError):
                job_0033.run()

        assert not PeriodicTask.objects.filter(pk=early_task.pk).exists()
        assert PeriodicTask.objects.filter(pk=late_task.pk).exists()

    def _attach_task(
        self, account_trash: AccountTrash, days: int, enabled: bool
    ) -> PeriodicTask:
        periodic_task = self._create_task(
            EMPTY_ACCOUNT_TASK, days=days, enabled=enabled, args=[account_trash.pk]
        )
        AccountTrash.objects.filter(pk=account_trash.pk).update(
            periodic_task=periodic_task
        )
        return periodic_task

    def _create_task(
        self, task: str, days: int, enabled: bool, args: list | None = None
    ) -> PeriodicTask:
        clocked = ClockedSchedule.objects.create(
            clocked_time=timezone.now() + timedelta(days=days)
        )
        return PeriodicTask.objects.create(
            name=f'{task} {clocked.pk}',
            task=task,
            clocked=clocked,
            one_off=True,
            enabled=enabled,
            args=json.dumps(args or []),
        )

    def _move_account_to_trash(self, user) -> AccountTrash:
        move_to_trash(
            request_author=self.admin,
            objects_list=[{'pk': user.pk, 'username': user.username}],
            grace_period=30,
            trash_type='user',
        )
        return AccountTrash.objects.get(user=user)
