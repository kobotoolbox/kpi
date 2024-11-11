from unittest.mock import MagicMock

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test import TestCase

from kpi.models import Asset
from kpi.signals import post_assign_asset_perm


class AssetPermissionSignalTest(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create(username='someuser')
        self.asset = Asset.objects.create(owner=self.user)
        self.asset.connect_deployment(backend='mock')
        self.asset.deployment.set_enketo_open_rosa_server = MagicMock()
        self.anonymous_user = AnonymousUser()

    def test_enketo_server_updated_for_anonymous_add_submissions(self):
        """
        Test that the Enketo server URL is updated correctly when an anonymous
        user is granted the 'add_submissions' permission. The Enketo URL should
        be updated to reflect anonymous access by setting `require_auth=False`
        """
        post_assign_asset_perm(
            sender=Asset,
            instance=self.asset,
            user=self.anonymous_user,
            codenames='add_submissions',
        )

        self.asset.deployment.set_enketo_open_rosa_server.assert_called_with(
            require_auth=False
        )

    def test_enketo_server_not_updated_for_other_permissions(self):
        """
        Test that the Enketo server URL is not updated when an authenticated
        user is granted any type of permission.
        """
        post_assign_asset_perm(
            sender=Asset,
            instance=self.asset,
            user=self.user,
            codenames='view_asset',
        )

        self.asset.deployment.set_enketo_open_rosa_server.assert_not_called()

    def test_enketo_server_not_updated_for_multiple_permissions(self):
        """
        Test that the Enketo server URL is not updated when a user has multiple
        permissions assigned.
        """
        post_assign_asset_perm(
            sender=Asset,
            instance=self.asset,
            user=self.user,
            codenames=['view_asset', 'change_asset', 'delete_submissions'],
        )

        self.asset.deployment.set_enketo_open_rosa_server.assert_not_called()
