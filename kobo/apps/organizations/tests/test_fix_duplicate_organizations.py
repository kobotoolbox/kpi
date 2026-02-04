from importlib import import_module
from unittest.mock import patch

from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import (
    Organization,
    OrganizationOwner,
    OrganizationUser,
)
from kpi.models import Asset, ObjectPermission

job = import_module('kobo.apps.long_running_migrations.jobs.0015_fix_duplicate_organizations')  # noqa


class TestFixDuplicateOrgs(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.organization = self.someuser.organization

    def test_keep_newest_when_no_mmo_and_no_subscription(self):
        """
        Test that when user is part of two single-member orgs with no MMO or
        active subscription, then the newest organization should be kept
        """
        second_org = self._create_organization_for_user(user=self.someuser)

        # Ensure `someuser` is now in two organizations
        orgs = Organization.objects.filter(organization_users__user=self.someuser)
        self.assertEqual(orgs.count(), 2)

        job.run()

        # Verify that only one organization remains for `someuser`
        orgs = Organization.objects.filter(organization_users__user=self.someuser)
        self.assertEqual(orgs.count(), 1)
        self.assertEqual(orgs.first().id, second_org.id)

    def test_keep_mmo_and_delete_single_member_org(self):
        """
        Test that when user is part of an MMO organization and a single-member
        organization, then the MMO organization should be kept
        """
        # Create an MMO organization
        mmo_org = self._create_organization_for_user(
            user=self.someuser, mmo_override=True
        )

        # Ensure `someuser` is now in two organizations
        orgs = Organization.objects.filter(organization_users__user=self.someuser)
        self.assertEqual(orgs.count(), 2)

        job.run()

        # Verify that only the MMO organization remains for `someuser`
        orgs = Organization.objects.filter(organization_users__user=self.someuser)
        self.assertEqual(orgs.count(), 1)
        self.assertEqual(orgs.first().id, mmo_org.id)

    def test_prefers_active_subscription_when_no_mmo(self):
        """
        Test that when user is part of two single-member orgs, one with an active
        subscription and one without, then the organization with the active
        subscription should be kept
        """
        # Create an organization with subscription
        org_with_subscription = self._create_organization_for_user(user=self.someuser)

        # Mock active subscription on org_with_subscription
        def active_subscription_mock(self):
            if self.pk == org_with_subscription.pk:
                return {'current_period_start': 'x'}
            return None

        with patch.object(
            Organization,
            'active_subscription_billing_details',
            new=active_subscription_mock
        ):
            job.run()

        # Verify that only the organization with active subscription remains
        orgs_after = Organization.objects.filter(organization_users__user=self.someuser)
        self.assertEqual(orgs_after.count(), 1)
        self.assertEqual(orgs_after.first().id, org_with_subscription.id)

    def test_keep_multi_member_org_when_no_mmo_override(self):
        """
        Test that when user is part of a multi-member org (with mmo_override False)
        and a single-member org, then the multi-member organization should be kept
        """
        multi_member_org = self.anotheruser.organization
        OrganizationUser.objects.create(
            organization=multi_member_org, user=self.someuser
        )

        # Ensure `someuser` is now in two organizations
        orgs = Organization.objects.filter(organization_users__user=self.someuser)
        self.assertEqual(orgs.count(), 2)

        job.run()

        # Verify that only the multi-member organization remains for `someuser`
        orgs = Organization.objects.filter(organization_users__user=self.someuser)
        self.assertEqual(orgs.count(), 1)
        self.assertEqual(orgs.first().id, multi_member_org.id)

    def test_asset_transfer_to_kept_organization(self):
        """
        Test that when duplicate organizations are resolved, the user's assets
        are transferred to the kept organization.

        Also verify that the `mmo_override` flag is set correctly on the kept org
        """
        another_org = self.anotheruser.organization
        OrganizationUser.objects.create(organization=another_org, user=self.someuser)

        # Verify that `mmo_override` is False for `another_org` despite
        # having multiple members
        self.assertFalse(another_org.mmo_override)

        asset1 = Asset.objects.create(name='Asset 1', owner=self.anotheruser)
        asset2 = Asset.objects.create(name='Asset 2', owner=self.someuser)
        asset3 = Asset.objects.create(name='Asset 3', owner=self.someuser)

        # Ensure `someuser` is now in two organizations
        orgs = Organization.objects.filter(organization_users__user=self.someuser)
        self.assertEqual(orgs.count(), 2)

        job.run()

        # Verify that only one organization remains for `someuser`
        orgs_after = Organization.objects.filter(organization_users__user=self.someuser)
        self.assertEqual(orgs_after.count(), 1)

        # Verify that `mmo_override` is now True for the kept organization
        kept_org = orgs_after.first()
        self.assertTrue(kept_org.mmo_override)

        # Verify that all assets are now owned by the kept organization
        asset1.refresh_from_db()
        asset2.refresh_from_db()
        asset3.refresh_from_db()
        self.assertEqual(asset1.owner, self.anotheruser)
        self.assertEqual(asset2.owner, self.anotheruser)
        self.assertEqual(asset3.owner, self.anotheruser)

    def test_owner_does_not_lose_permissions_on_removal(self):
        """
        Verify that when a duplicate organization is removed, if the user being
        processed is the owner of that org, they DO NOT lose their own permissions
        """
        # Give someuser a second organization where they are also the owner
        self._create_organization_for_user(user=self.someuser)

        # Create an asset owned by someuser and assign them a permission
        asset = Asset.objects.create(name='Owner Project', owner=self.someuser)

        # Get all permissions for the asset
        initial_perms = set(ObjectPermission.objects.filter(
            user=self.someuser,
            asset=asset
        ).values_list('permission_id', flat=True))

        job.run()

        # Verify that only one organization remains for someuser
        self.assertEqual(
            OrganizationUser.objects.filter(user=self.someuser).count(), 1
        )

        # Verify that someuser still has all their initial permissions on the asset
        final_perms = set(ObjectPermission.objects.filter(
            user=self.someuser,
            asset=asset
        ).values_list('permission_id', flat=True))
        self.assertEqual(initial_perms, final_perms)

    def _create_organization_for_user(self, user, mmo_override=False):
        org = Organization.objects.create(name='Org', mmo_override=mmo_override)
        org_user = OrganizationUser.objects.create(organization=org, user=user)
        OrganizationOwner.objects.create(organization=org, organization_user=org_user)
        return org
