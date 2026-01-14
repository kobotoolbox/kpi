from importlib import import_module
from unittest.mock import patch

from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import (
    Organization,
    OrganizationUser,
)

job = import_module('kobo.apps.long_running_migrations.jobs.0014_fix_duplicate_organizations')  # noqa


class TestFixDuplicateOrgs(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.organization = self.someuser.organization

    def test_keep_newest_when_no_mmo_and_no_subscription(self):
        """
        Test that when user is part of two single-member orgs with no MMO or
        active subscription, then the newest organization should be kept
        """
        second_org = Organization.objects.create(name='Second Org')
        OrganizationUser.objects.create(organization=second_org, user=self.someuser)

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
        mmo_org = Organization.objects.create(name='MMO Org', mmo_override=True)
        OrganizationUser.objects.create(organization=mmo_org, user=self.someuser)

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
        org_with_subscription = Organization.objects.create(
            name='Org With Subscription'
        )
        OrganizationUser.objects.create(
            organization=org_with_subscription, user=self.someuser
        )

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
        multi_member_org = Organization.objects.create(name='Multi Member Org')
        other_user = User.objects.create(username='otheruser')
        OrganizationUser.objects.create(organization=multi_member_org, user=self.someuser)
        OrganizationUser.objects.create(organization=multi_member_org, user=other_user)

        # Ensure `someuser` is now in two organizations
        orgs = Organization.objects.filter(organization_users__user=self.someuser)
        self.assertEqual(orgs.count(), 2)

        job.run()

        # Verify that only the multi-member organization remains for `someuser`
        orgs = Organization.objects.filter(organization_users__user=self.someuser)
        self.assertEqual(orgs.count(), 1)
        self.assertEqual(orgs.first().id, multi_member_org.id)
