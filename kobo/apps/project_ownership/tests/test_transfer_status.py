from django.contrib.auth import get_user_model
from django.test import TestCase

from kpi.models import Asset
from kpi.tests.utils.transaction import immediate_on_commit
from ..models import (
    Invite,
    InviteStatusChoices,
    Transfer,
    TransferStatus,
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

        assert self.invite.status == InviteStatusChoices.PENDING
        assert self.transfer.status == TransferStatusChoices.PENDING
        for transfer_sub_status in self.transfer.statuses.all():
            assert (
                transfer_sub_status.status
                == TransferStatusChoices.PENDING
            )

    def test_calculated_in_progress_invite_status(self):

        self.transfer.status = TransferStatusChoices.IN_PROGRESS
        self.invite.refresh_from_db()
        assert self.invite.status == InviteStatusChoices.IN_PROGRESS

    def test_calculated_in_success_invite_status(self):

        self.transfer.status = TransferStatusChoices.SUCCESS
        self.invite.refresh_from_db()
        assert self.invite.status == InviteStatusChoices.COMPLETE

    def test_calculated_failed_invite_status(self):

        self.transfer.status = TransferStatusChoices.FAILED
        self.invite.refresh_from_db()
        assert self.invite.status == InviteStatusChoices.FAILED

    def test_calculated_success_transfer_status(self):

        # Simulate transfer beginning
        self.transfer.status = TransferStatusChoices.IN_PROGRESS

        # Mark media files task as success
        media_files_async_task = self.transfer.statuses.get(
            status_type=TransferStatusTypeChoices.MEDIA_FILES
        )
        media_files_async_task.status = TransferStatusChoices.SUCCESS
        media_files_async_task.save(update_fields=['status'])
        media_files_async_task.update_transfer_status()

        # Transfer is still in progress
        self.transfer.refresh_from_db()
        assert self.transfer.status == TransferStatusChoices.IN_PROGRESS

        # Mark all async tasks as success
        for transfer_sub_status in self.transfer.statuses.exclude(
            status_type=TransferStatusTypeChoices.GLOBAL
        ):
            transfer_sub_status.status = TransferStatusChoices.SUCCESS
            transfer_sub_status.save(update_fields=['status'])
            transfer_sub_status.update_transfer_status()

        # Transfer should be marked as success too now…
        self.transfer.refresh_from_db()
        assert self.transfer.status == TransferStatusChoices.SUCCESS

        # … and invite should be marked as completed.
        self.invite.refresh_from_db()
        assert self.invite.status == InviteStatusChoices.COMPLETE

    def test_calculated_failed_transfer_status(self):

        # Simulate transfer beginning
        self.transfer.status = TransferStatusChoices.IN_PROGRESS

        # Update status of media files task
        media_files_async_task = self.transfer.statuses.get(
            status_type=TransferStatusTypeChoices.MEDIA_FILES
        )
        media_files_async_task.status = TransferStatusChoices.FAILED
        media_files_async_task.save(update_fields=['status'])
        media_files_async_task.update_transfer_status()

        # Transfer should be marked as failed right away
        self.transfer.refresh_from_db()
        assert self.transfer.status == TransferStatusChoices.FAILED

        # Same as the invite
        self.invite.refresh_from_db()
        assert self.invite.status == InviteStatusChoices.FAILED

    def test_draft_project_transfer(self):
        # When a project is a draft, there are no celery tasks called to move
        # submissions (and related attachments).
        with immediate_on_commit():
            self.transfer.transfer_project()

        assert self.transfer.status == TransferStatusChoices.SUCCESS

        # However, the status of each async task should still be updated to
        # 'success'.
        for transfer_status in self.transfer.statuses.all():
            assert transfer_status.status == TransferStatusChoices.SUCCESS

    def test_update_status_of_previously_succeeded_transfer_is_noop(self):
        # `success` is terminal: a later update must not downgrade the row or
        # write an error.
        submissions_status = self.transfer.statuses.get(
            status_type=TransferStatusTypeChoices.SUBMISSIONS
        )
        TransferStatus.update_status(
            transfer_id=self.transfer.id,
            status_type=TransferStatusTypeChoices.SUBMISSIONS,
            status=TransferStatusChoices.SUCCESS,
        )
        TransferStatus.update_status(
            transfer_id=self.transfer.id,
            status_type=TransferStatusTypeChoices.SUBMISSIONS,
            status=TransferStatusChoices.FAILED,
            error='late failure signal',
        )
        submissions_status.refresh_from_db()
        assert submissions_status.status == TransferStatusChoices.SUCCESS
        assert submissions_status.errors.count() == 0

    def test_terminal_success_does_not_flip_completed_invite(self):
        # Bring every sub-task to success so the invite is complete.
        self.transfer.status = TransferStatusChoices.IN_PROGRESS
        for status_type, _ in TransferStatusTypeChoices.choices:
            if status_type == TransferStatusTypeChoices.GLOBAL:
                continue
            TransferStatus.update_status(
                self.transfer.id, TransferStatusChoices.SUCCESS, status_type
            )
        self.invite.refresh_from_db()
        assert self.invite.status == InviteStatusChoices.COMPLETE

        # A late FAILED signal on an already-successful sub-task is ignored.
        TransferStatus.update_status(
            self.transfer.id,
            TransferStatusChoices.FAILED,
            TransferStatusTypeChoices.ATTACHMENTS,
            error='late failure signal',
        )
        self.transfer.refresh_from_db()
        self.invite.refresh_from_db()
        assert self.transfer.status == TransferStatusChoices.SUCCESS
        assert self.invite.status == InviteStatusChoices.COMPLETE

    def test_transfer_does_not_produce_new_version(self):
        asset = self.transfer.asset
        # save to create an initial version
        asset.save()
        initial_version_count = asset.asset_versions.count()
        with immediate_on_commit():
            self.transfer.transfer_project()
        asset.refresh_from_db()
        assert asset.asset_versions.count() == initial_version_count
