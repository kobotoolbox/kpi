from datetime import timedelta
from unittest.mock import call, patch

from constance.test import override_config
from ddt import data, ddt, unpack
from django.test import TestCase, override_settings
from django.utils import timezone
from freezegun import freeze_time
from model_bakery import baker

from kobo.apps.project_ownership.models.choices import InviteStatusChoices
from kobo.apps.project_ownership.models.invite import InviteType
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

    def create_standard_transfer(
        self, asset=None, invite_status=InviteStatusChoices.ACCEPTED
    ):
        transfer_asset = asset or self.asset
        invite = Invite.objects.create(
            sender=self.someuser, recipient=self.anotheruser, status=invite_status
        )
        return Transfer.objects.create(invite=invite, asset=transfer_asset)

    def test_task_restarter_ignores_unaccepted_pending_transfers(self):
        """
        Ensure that even if a transfer is old/stale, it is ignored
        if the recipient has not yet clicked the 'Accept' link.
        """
        resume_cutoff = timezone.now() - timedelta(minutes=15)
        with freeze_time(resume_cutoff):
            # Invite is PENDING
            self.create_standard_transfer(invite_status=InviteStatusChoices.PENDING)

        with patch.object(Transfer, 'transfer_project') as patched_transfer:
            with patch(
                'kobo.apps.project_ownership.tasks.async_task.delay'
            ) as patched_task:
                task_restarter()

        # Verification: Neither the main transfer nor subtasks should run
        patched_transfer.assert_not_called()
        patched_task.assert_not_called()

    def test_task_restarter_restarts_pending_org_transfers(self):
        resume_cutoff = timezone.now() - timedelta(minutes=15)
        with freeze_time(resume_cutoff):
            # Use the base models.Model.save() approach to bypass
            # manager .create() logic
            invite = Invite(
                sender=self.someuser,
                recipient=self.anotheruser,
                invite_type=InviteType.ORG_MEMBERSHIP,
                status=InviteStatusChoices.PENDING,
            )
            invite.save()

            _ = Transfer.objects.create(invite=invite, asset=self.asset)

        with patch.object(Transfer, 'transfer_project') as patched_transfer:
            task_restarter()

        # This SHOULD be called because the 'excluded_pending_user_ownership_invites'
        # filter specifically only ignores USER_OWNERSHIP_TRANSFER + PENDING.
        patched_transfer.assert_called_once()

    def test_task_restarter_restarts_accepted_pending_transfers(self):
        # we don't count pending transfers as "stuck", so they can be created before
        # the stuck threshold
        resume_cutoff = timezone.now() - timedelta(minutes=15)
        with freeze_time(resume_cutoff):
            # entire transfer is waiting in PENDING
            # Invite is ACCEPTED (the 'correct' state for a restart)
            self.create_standard_transfer(invite_status=InviteStatusChoices.ACCEPTED)

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

    # in progress, time_delta (15 for a task that is too old,
    # 2 for a task that is too recent)
    @data(
        (True, 15),
        (True, 2),
        # old pending tasks are tested elsewhere
        (False, 2),
    )
    @unpack
    def test_task_restarter_ignores_tasks_too_old_or_too_new(
        self, in_progress, time_delta
    ):
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
