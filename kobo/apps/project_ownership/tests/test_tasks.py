from datetime import timedelta
from unittest.mock import call, patch

from constance.test import override_config
from ddt import data, ddt, unpack
from django.test import TestCase, override_settings
from django.utils import timezone
from freezegun import freeze_time
from model_bakery import baker

from kpi.models import Asset
from ...kobo_auth.shortcuts import User
from ..models import (
    Invite,
    Transfer,
    TransferStatus,
    TransferStatusChoices,
    TransferStatusTypeChoices,
)
from ..tasks import task_restarter


@override_config(PROJECT_OWNERSHIP_RESUME_THRESHOLD=5)
@override_config(PROJECT_OWNERSHIP_STUCK_THRESHOLD=10)
@ddt
class ProjectOwnershipTasksTestCase(TestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.asset = Asset.objects.get(pk=1)

    def create_standard_transfer(self, asset=None):
        transfer_asset = asset or self.asset
        invite = Invite.objects.create(sender=self.someuser, recipient=self.anotheruser)
        return Transfer.objects.create(invite=invite, asset=transfer_asset)

    def test_task_restarter_restarts_pending_transfers(self):
        # we don't count pending transfers as "stuck", so they can be created before
        # the stuck threshold
        resume_cutoff = timezone.now() - timedelta(minutes=15)
        with freeze_time(resume_cutoff):
            # entire transfer is waiting in PENDING
            self.create_standard_transfer()

        with patch.object(Transfer, 'transfer_project') as patched_transfer:
            with patch(
                'kobo.apps.project_ownership.tasks.async_task.delay'
            ) as patched_task:
                task_restarter()
        # make sure we only called project.transfer and not the async task directly
        patched_transfer.assert_called_once()
        patched_task.assert_not_called()

    def test_task_restarter_restarts_pending_statuses_for_in_progress_transfers(self):
        # we don't count pending tasks as "stuck", so they can be created before
        # the stuck threshold
        created_time = timezone.now() - timedelta(minutes=15)
        with freeze_time(created_time):
            # transfer is in progress but individual tasks are pending
            transfer = self.create_standard_transfer()
            transfer.status = TransferStatusChoices.IN_PROGRESS
            transfer.save()

        with patch(
            'kobo.apps.project_ownership.tasks.async_task.delay'
        ) as patched_task:
            task_restarter()
        # make sure we only called project.transfer and not the async task directly
        patched_task.assert_has_calls(
            [
                call(transfer.pk, TransferStatusTypeChoices.MEDIA_FILES),
                call(transfer.pk, TransferStatusTypeChoices.SUBMISSIONS),
            ],
            any_order=True,
        )
        # make sure we didn't also restart the attachments task. that should be
        # handled by the submissions task
        assert len(patched_task.call_args_list) == 2

    def test_task_restarter_restarts_in_progress_transfers(self):
        # simulate a time after the stuck threshold but before the resume threshold
        created_time = timezone.now() - timedelta(minutes=8)
        with freeze_time(created_time):
            transfer = self.create_standard_transfer()
            # set all subtasks to in progress
            for status_type, _ in TransferStatusTypeChoices.choices:
                TransferStatus.update_status(
                    transfer.id, TransferStatusChoices.IN_PROGRESS, status_type
                )

        with patch(
            'kobo.apps.project_ownership.tasks.async_task.delay'
        ) as patched_task:
            task_restarter()
        patched_task.assert_has_calls(
            [
                call(transfer.pk, TransferStatusTypeChoices.MEDIA_FILES),
                call(transfer.pk, TransferStatusTypeChoices.SUBMISSIONS),
                call(transfer.pk, TransferStatusTypeChoices.ATTACHMENTS),
            ],
            any_order=True,
        )
        assert len(patched_task.call_args_list) == 3

    # in progress, too old, too recent
    @data(
        (True, True, False),
        (True, False, True),
        # old pending tasks are tested elsewhere
        (False, False, True),
    )
    @unpack
    def test_task_restarter_ignores_tasks_too_old_or_too_new(
        self, in_progress, too_old, too_recent
    ):
        if too_recent:
            time_delta = 2
        elif too_old:
            time_delta = 15
        else:
            time_delta = 0
        with freeze_time(timezone.now() - timedelta(minutes=time_delta)):
            transfer = self.create_standard_transfer()
            if in_progress:
                # set all subtasks to in progress
                for status_type, _ in TransferStatusTypeChoices.choices:
                    TransferStatus.update_status(
                        transfer.id, TransferStatusChoices.IN_PROGRESS, status_type
                    )

        with patch(
            'kobo.apps.project_ownership.tasks.async_task.delay'
        ) as patched_task:
            task_restarter()

        patched_task.assert_not_called()

    @override_settings(MAX_RESTARTED_TRANSFERS=2)
    @override_settings(MAX_RESTARTED_TASKS=2)
    def test_task_restarter_limits_number_of_restarts(self):
        assets = [baker.make(Asset, owner=self.someuser, uid=f'a{i}') for i in range(6)]
        with freeze_time(timezone.now() - timedelta(minutes=8)):
            # create 3 pending transfers and 3 in progress with pending tasks
            for i, asset in enumerate(assets):
                transfer = self.create_standard_transfer(assets[i])
                if i >= 3:
                    transfer.status = TransferStatusChoices.IN_PROGRESS
                    transfer.save()
        with patch.object(Transfer, 'transfer_project') as patched_transfer:
            with patch(
                'kobo.apps.project_ownership.tasks.async_task.delay'
            ) as patched_task:
                task_restarter()
        assert len(patched_task.call_args_list) == 2
        assert len(patched_transfer.call_args_list) == 2
