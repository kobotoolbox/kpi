from django.contrib import admin as django_admin
from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.test import TestCase

from kpi.models import Asset
from ..admin import InviteAdmin, TransferAdmin
from ..models import Invite, Transfer
from ..models.choices import TransferStatusErrorLevelChoices
from ..models.transfer import TransferStatusError, TransferStatusTypeChoices


class ProjectOwnershipAdminTestCase(TestCase):

    fixtures = ['test_data']

    def setUp(self):
        User = get_user_model()  # noqa
        someuser = User.objects.get(username='someuser')
        anotheruser = User.objects.get(username='anotheruser')
        asset = Asset.objects.get(pk=1)
        self.invite = Invite.objects.create(sender=someuser, recipient=anotheruser)
        self.transfer = Transfer.objects.create(invite=self.invite, asset=asset)

    def test_transfer_admin_is_registered_and_read_only(self):
        assert Transfer in django_admin.site._registry
        transfer_admin = django_admin.site._registry[Transfer]
        assert transfer_admin.has_add_permission(request=None) is False
        assert transfer_admin.has_change_permission(request=None) is False
        assert transfer_admin.has_delete_permission(request=None) is False

    def test_invite_get_transfers_shows_summary_and_links(self):
        invite_admin = InviteAdmin(Invite, AdminSite())
        html = invite_admin.get_transfers(self.invite)
        # A summary line + links to the transfers and the logs, both filtered
        # to this invite, not a dump.
        assert 'View transfers' in html
        assert f'invite_id={self.invite.id}' in html
        assert 'View logs' in html
        assert f'transfer_status__transfer__invite_id={self.invite.id}' in html
        # The per-status error blocks are no longer dumped inline.
        assert '<ol>' not in html

    def test_invite_get_transfers_error_count_matches_drill_down(self):
        submissions_status = self.transfer.statuses.get(
            status_type=TransferStatusTypeChoices.SUBMISSIONS
        )
        global_status = self.transfer.statuses.get(
            status_type=TransferStatusTypeChoices.GLOBAL
        )
        TransferStatusError.objects.create(
            transfer_status=submissions_status, error='sub-task failed'
        )
        TransferStatusError.objects.create(
            transfer_status=global_status, error='global failure'
        )

        invite_admin = InviteAdmin(Invite, AdminSite())
        html = invite_admin.get_transfers(self.invite)

        # The count must match what the drill-down displays.
        assert '— 2 error record(s).' in html

    def test_transfer_admin_get_statuses_shows_global_error(self):
        global_status = self.transfer.statuses.get(
            status_type=TransferStatusTypeChoices.GLOBAL
        )
        TransferStatusError.objects.create(
            transfer_status=global_status,
            error='Error occurred while processing transfer',
        )

        transfer_admin = TransferAdmin(Transfer, AdminSite())
        html = transfer_admin.get_statuses(self.transfer)

        # Only GLOBAL carries an error; it must still be visible.
        assert 'Error occurred while processing transfer' in html

    def test_transfer_admin_get_statuses_escapes_error_text(self):
        # Error text can contain user input, e.g. an uploaded filename.
        submissions_status = self.transfer.statuses.get(
            status_type=TransferStatusTypeChoices.SUBMISSIONS
        )
        TransferStatusError.objects.create(
            transfer_status=submissions_status,
            error='Error moving <script>alert(1)</script>',
        )

        transfer_admin = TransferAdmin(Transfer, AdminSite())
        html = transfer_admin.get_statuses(self.transfer)

        assert '<script>' not in html
        assert '&lt;script&gt;alert(1)&lt;/script&gt;' in html

    def test_invite_get_transfers_error_count_ignores_skipped_files(self):
        # Skips are not failures and must not be counted.
        submissions_status = self.transfer.statuses.get(
            status_type=TransferStatusTypeChoices.SUBMISSIONS
        )
        TransferStatusError.objects.create(
            transfer_status=submissions_status,
            error='Error moving roster.csv: connection reset by peer',
        )
        TransferStatusError.objects.create(
            transfer_status=submissions_status,
            error='Source file photo.jpg (#1) no longer exists — skipped',
            level=TransferStatusErrorLevelChoices.INFO,
        )

        invite_admin = InviteAdmin(Invite, AdminSite())
        html = invite_admin.get_transfers(self.invite)

        # Two records exist, only the genuine error is counted.
        assert '— 1 error record(s).' in html

    def test_transfer_admin_get_statuses_hides_skipped_files(self):
        # A skip is not a failure: the transfer reads as a plain success and
        # the detail stays in the log admin.
        attachments_status = self.transfer.statuses.get(
            status_type=TransferStatusTypeChoices.ATTACHMENTS
        )
        TransferStatusError.objects.create(
            transfer_status=attachments_status,
            error='Source file photo.jpg (#1) no longer exists — skipped',
            level=TransferStatusErrorLevelChoices.INFO,
        )

        transfer_admin = TransferAdmin(Transfer, AdminSite())
        html = transfer_admin.get_statuses(self.transfer)

        assert 'skipped' not in html
        assert 'Source file photo.jpg' not in html
        assert 'class="error"' not in html

    def test_transfer_status_error_log_admin_is_registered_and_read_only(self):
        assert TransferStatusError in django_admin.site._registry
        log_admin = django_admin.site._registry[TransferStatusError]
        assert log_admin.has_add_permission(request=None) is False
        assert log_admin.has_change_permission(request=None) is False
        assert log_admin.has_delete_permission(request=None) is False
        # The per-invite deep link from the invite page must resolve.
        assert log_admin.lookup_allowed(
            'transfer_status__transfer__invite_id', '1', None
        )
