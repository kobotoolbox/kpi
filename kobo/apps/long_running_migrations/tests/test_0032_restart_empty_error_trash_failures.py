import importlib
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from kobo.apps.trash_bin.models import TrashStatus
from kobo.apps.trash_bin.models.account import AccountTrash
from kobo.apps.trash_bin.models.project import ProjectTrash
from kobo.apps.trash_bin.utils import move_to_trash

job_0032 = importlib.import_module(
    'kobo.apps.long_running_migrations.jobs.0032_restart_empty_error_trash_failures'
)


class RestartEmptyErrorTrashFailuresTestCase(TestCase):
    """
    The job must restart FAILED trash objects that carry no error (empty or
    missing `failure_error`) and leave every other failure untouched
    """

    fixtures = ['test_data']

    def setUp(self):
        self.admin = get_user_model().objects.get(username='adminuser')
        self.someuser = get_user_model().objects.get(username='someuser')
        self.anotheruser = get_user_model().objects.get(username='anotheruser')

    def test_run_restarts_only_objects_without_an_error(self):
        # Row 1: FAILED with an empty error -> restarted
        empty_error = self._move_account_to_trash(self.someuser)
        stale = timezone.now() - timedelta(days=30)
        AccountTrash.objects.filter(pk=empty_error.pk).update(
            status=TrashStatus.FAILED,
            metadata={'failure_error': ''},
            date_modified=stale,
        )

        # Row 2: FAILED with no `failure_error` key at all -> restarted
        missing_error = self._move_account_to_trash(self.anotheruser)
        AccountTrash.objects.filter(pk=missing_error.pk).update(
            status=TrashStatus.FAILED, metadata={}
        )

        # Row 3: FAILED with a real error -> left untouched
        real_error = self._move_asset_to_trash(self.someuser)
        ProjectTrash.objects.filter(pk=real_error.pk).update(
            status=TrashStatus.FAILED,
            metadata={'failure_error': 'deadlock detected'},
        )

        job_0032.run()

        empty_error.refresh_from_db()
        missing_error.refresh_from_db()
        real_error.refresh_from_db()

        assert empty_error.status == TrashStatus.IN_PROGRESS
        assert missing_error.status == TrashStatus.IN_PROGRESS
        assert real_error.status == TrashStatus.FAILED

        # `date_modified` must stay stale, otherwise `task_restarter` would not
        # treat the restarted object as stuck
        assert empty_error.date_modified == stale

    def _move_account_to_trash(self, user):
        move_to_trash(
            request_author=self.admin,
            objects_list=[{'pk': user.pk, 'username': user.username}],
            grace_period=1,
            trash_type='user',
        )
        return AccountTrash.objects.get(user=user)

    def _move_asset_to_trash(self, user):
        asset = user.assets.first()
        move_to_trash(
            request_author=user,
            objects_list=[
                {'pk': asset.pk, 'asset_uid': asset.uid, 'asset_name': asset.name}
            ],
            grace_period=1,
            trash_type='asset',
        )
        return ProjectTrash.objects.get(asset=asset)
