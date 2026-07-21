from django.contrib import admin as django_admin
from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.test import TestCase

from kpi.models import Asset
from ..admin import InviteAdmin
from ..models import Invite, Transfer
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

    def test_invite_get_transfers_shows_summary_and_link(self):
        invite_admin = InviteAdmin(Invite, AdminSite())
        html = invite_admin.get_transfers(self.invite)
        # A summary line + a link to the filtered transfer changelist, not a dump.
        assert 'View transfers' in html
        assert f'invite__id__exact={self.invite.id}' in html
        # The per-status error blocks are no longer dumped inline.
        assert '<ol>' not in html

    def test_invite_get_transfers_error_count_excludes_global_status(self):
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

        # Only the non-GLOBAL error should be counted, matching what
        # TransferAdmin.get_statuses actually displays on the drill-down page.
        assert '1 error record' in html
        assert '2 error record' not in html
