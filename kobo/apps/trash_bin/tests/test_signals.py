from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from django_celery_beat.models import ClockedSchedule, PeriodicTask, PeriodicTasks

from ..models.account import AccountTrash
from ..tasks import garbage_collector
from ..utils import move_to_trash, put_back, temporarily_disconnect_signals

BEAT_ROW_TABLE = f'"{PeriodicTasks._meta.db_table}"'


class TemporarilyDisconnectSignalsTestCase(TestCase):
    """
    Celery Beat's `PeriodicTasks` row must not be updated by the trash bin.
    Updating it locks the row until the transaction commits, which makes
    concurrent workers wait on each other
    """

    fixtures = ['test_data']

    def setUp(self):
        self.someuser = get_user_model().objects.get(username='someuser')
        self.adminuser = get_user_model().objects.get(username='adminuser')
        # Make sure the row exists, otherwise comparing its timestamp proves
        # nothing
        PeriodicTasks.update_changed()
        self.last_change = PeriodicTasks.last_change()

    def test_move_to_trash_does_not_update_beat_row(self):
        with CaptureQueriesContext(connection) as ctx:
            self._move_someuser_to_trash()

        self._assert_beat_row_untouched(ctx)

    def test_put_back_does_not_update_beat_row(self):
        self._move_someuser_to_trash()

        with CaptureQueriesContext(connection) as ctx:
            put_back(
                request_author=self.adminuser,
                objects_list=[
                    {'pk': self.someuser.pk, 'username': self.someuser.username}
                ],
                trash_type='user',
            )

        self._assert_beat_row_untouched(ctx)

    def test_garbage_collector_does_not_update_beat_row(self):
        self._move_someuser_to_trash()
        periodic_task_id = AccountTrash.objects.get(user=self.someuser).periodic_task_id
        # Leave the periodic task orphaned, as `process_deletion()` does
        AccountTrash.objects.filter(user=self.someuser).delete()

        with CaptureQueriesContext(connection) as ctx:
            garbage_collector()

        self.assertFalse(PeriodicTask.objects.filter(pk=periodic_task_id).exists())
        self._assert_beat_row_untouched(ctx)

    def test_signals_are_connected_again_after_the_block(self):
        # Bulk operations only, like the trash bin does: `PeriodicTask.save()`
        # and `PeriodicTask.delete()` notify Celery Beat themselves, without
        # any signal
        with temporarily_disconnect_signals(save=True, delete=True):
            clocked = ClockedSchedule.objects.create(clocked_time=timezone.now())
            periodic_task = PeriodicTask.objects.bulk_create(
                [PeriodicTask(name='test', task='test', clocked=clocked, one_off=True)]
            )[0]
            PeriodicTask.objects.filter(pk=periodic_task.pk).delete()
        self.assertEqual(PeriodicTasks.last_change(), self.last_change)

        # Outside the block, the signals notify Celery Beat again as usual
        ClockedSchedule.objects.create(clocked_time=timezone.now())
        self.assertGreater(PeriodicTasks.last_change(), self.last_change)

    def _assert_beat_row_untouched(self, ctx: CaptureQueriesContext):
        beat_row_queries = [
            query['sql']
            for query in ctx.captured_queries
            if BEAT_ROW_TABLE in query['sql']
        ]
        self.assertEqual(beat_row_queries, [])
        self.assertEqual(PeriodicTasks.last_change(), self.last_change)

    def _move_someuser_to_trash(self):
        move_to_trash(
            request_author=self.someuser,
            objects_list=[{'pk': self.someuser.pk, 'username': self.someuser.username}],
            grace_period=1,
            trash_type='user',
        )
