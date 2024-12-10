from constance.test import override_config
from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import PERM_MANAGE_ASSET
from kpi.models import Asset
from kpi.tests.utils.transaction import immediate_on_commit
from ..utils import create_invite


@override_config(PROJECT_OWNERSHIP_AUTO_ACCEPT_INVITES=True)
class ProjectOwnershipPermissionTestCase(TestCase):
    """
    The purpose of this test suite is solely to verify permission assignment.
    To achieve this, PROJECT_OWNERSHIP_AUTO_ACCEPT_INVITES is set to True, allowing
    the email invitation system to be bypassed and eliminating the need to process it
    during testing.
    """

    fixtures = ['test_data']

    def setUp(self):

        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.thirduser = User.objects.create_user(
            username='thirduser',
            password='thirduser',
            email='thirduser@example.com',
        )
        self.asset = Asset.objects.get(pk=1)

    def test_recipient_as_regular_user_is_owner(self):
        assert self.asset.owner == self.someuser
        with immediate_on_commit():
            create_invite(
                sender=self.someuser,
                recipient=self.anotheruser,
                assets=[self.asset],
                invite_class_name='Invite',
            )

        self.asset.refresh_from_db()
        # New owner should anotheruser
        assert self.asset.owner == self.anotheruser
        # The previous owner should have received "manage_asset" permission
        assert self.asset.has_perm(self.someuser, PERM_MANAGE_ASSET)

    def test_recipient_as_org_member_is_owner(self):
        # Make anotheruser's organization a MMO…
        organization = self.anotheruser.organization
        organization.mmo_override = True
        organization.save()
        # … and add thirduser to it
        organization.add_user(self.thirduser)
        assert self.asset.owner == self.someuser
        # send the invite to thirduser
        with immediate_on_commit():
            create_invite(
                sender=self.someuser,
                recipient=self.thirduser,
                assets=[self.asset],
                invite_class_name='Invite',
            )

        self.asset.refresh_from_db()
        # anotheruser should be the owner now (because they are the owner of
        # thirduser's organization
        assert self.asset.owner == self.anotheruser

        # The previous owner should have received "manage_asset" permission
        assert self.asset.has_perm(self.someuser, PERM_MANAGE_ASSET)
        # The invite recipient should have received "manage_asset" permission too
        assert self.asset.has_perm(self.thirduser, PERM_MANAGE_ASSET)
