from django.contrib.auth import get_user_model
from django.test import TestCase

from kpi.models import Asset
from ..models import (
    Invite,
    InviteStatusChoices,
    Transfer,
    TransferStatusChoices,
    TransferStatusTypeChoices,
)


class ProjectOwnershipTransferStatusTestCase(TestCase):

    fixtures = ['test_data']

    def setUp(self):

        User = get_user_model()  # noqa
        someuser = User.objects.get(username='someuser')
        anotheruser = User.objects.get(username='anotheruser')
        asset = Asset.objects.get(pk=1)
        self.invite = Invite.objects.create(sender=someuser, recipient=anotheruser)
        self.transfer = Transfer.objects.create(invite=self.invite, asset=asset)

        assert self.invite.status == InviteStatusChoices.PENDING.value
        assert self.transfer.status == TransferStatusChoices.PENDING.value
        for transfer_sub_status in self.transfer.statuses.all():
            assert (
                transfer_sub_status.status
                == TransferStatusChoices.PENDING.value
            )

    def test_calculated_in_progress_invite_status(self):

        self.transfer.status = TransferStatusChoices.IN_PROGRESS.value
        self.invite.refresh_from_db()
        assert self.invite.status == InviteStatusChoices.IN_PROGRESS.value

    def test_calculated_in_success_invite_status(self):

        self.transfer.status = TransferStatusChoices.SUCCESS.value
        self.invite.refresh_from_db()
        assert self.invite.status == InviteStatusChoices.COMPLETE.value

    def test_calculated_failed_invite_status(self):

        self.transfer.status = TransferStatusChoices.FAILED.value
        self.invite.refresh_from_db()
        assert self.invite.status == InviteStatusChoices.FAILED.value

    def test_calculated_success_transfer_status(self):

        # Simulate transfer beginning
        self.transfer.status = TransferStatusChoices.IN_PROGRESS.value

        # Mark media files task as success
        media_files_async_task = self.transfer.statuses.get(
            status_type=TransferStatusTypeChoices.MEDIA_FILES.value
        )
        media_files_async_task.status = TransferStatusChoices.SUCCESS.value
        media_files_async_task.save(update_fields=['status'])
        media_files_async_task.update_transfer_status()

        # Transfer is still in progress
        self.transfer.refresh_from_db()
        assert self.transfer.status == TransferStatusChoices.IN_PROGRESS.value

        # Mark all async tasks as success
        for transfer_sub_status in self.transfer.statuses.exclude(
            status_type=TransferStatusTypeChoices.GLOBAL.value
        ):
            transfer_sub_status.status = TransferStatusChoices.SUCCESS.value
            transfer_sub_status.save(update_fields=['status'])
            transfer_sub_status.update_transfer_status()

        # Transfer should be marked as success too now…
        self.transfer.refresh_from_db()
        assert self.transfer.status == TransferStatusChoices.SUCCESS.value

        # … and invite should be marked as completed.
        self.invite.refresh_from_db()
        assert self.invite.status == InviteStatusChoices.COMPLETE.value

    def test_calculated_failed_transfer_status(self):

        # Simulate transfer beginning
        self.transfer.status = TransferStatusChoices.IN_PROGRESS.value

        # Update status of media files task
        media_files_async_task = self.transfer.statuses.get(
            status_type=TransferStatusTypeChoices.MEDIA_FILES.value
        )
        media_files_async_task.status = TransferStatusChoices.FAILED.value
        media_files_async_task.save(update_fields=['status'])
        media_files_async_task.update_transfer_status()

        # Transfer should be marked as failed right away
        self.transfer.refresh_from_db()
        assert self.transfer.status == TransferStatusChoices.FAILED.value

        # Same as the invite
        self.invite.refresh_from_db()
        assert self.invite.status == InviteStatusChoices.FAILED.value
