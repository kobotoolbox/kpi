from importlib import import_module
from django.test import TestCase
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import (
    Organization,
    OrganizationOwner,
    OrganizationUser,
)

job = import_module('kobo.apps.long_running_migrations.jobs.0017_remove_organizations_of_deleted_users')  # noqa


class TestRemoveOrganizationsOfDeletedUsers(TestCase):

    def setUp(self):
        self.active_user = User.objects.create_user(
            username='active_user', password='password'
        )
        self.removed_user = User.objects.create_user(
            username='removed_user', password='password'
        )
        self.removed_user.is_active = False
        self.removed_user.save()

        # Set the `date_removed` on the related `extra_details` profile
        self.removed_user.extra_details.date_removed = timezone.now()
        self.removed_user.extra_details.save()

    def test_deletes_org_with_single_removed_user(self):
        """
        Test that an organization is deleted if it has exactly one user
        and that user is fully removed (inactive + date_removed is set)
        """
        org = self._create_organization_for_user(self.removed_user, 'Removed User Org')
        self.assertTrue(Organization.objects.filter(id=org.id).exists())

        job.run()
        self.assertFalse(Organization.objects.filter(id=org.id).exists())

    def test_keeps_org_with_single_active_user(self):
        """
        Test that an organization is kept if its single owner is still active
        """
        org = self._create_organization_for_user(self.active_user, 'Active User Org')

        job.run()
        self.assertTrue(Organization.objects.filter(id=org.id).exists())

    def test_keeps_org_with_multiple_users_even_if_owner_is_removed(self):
        """
        Test that an organization is kept if it has multiple users,
        even if the owner is fully removed
        """
        org = self._create_organization_for_user(self.removed_user, 'Multi Member Org')

        # Add a second (active) user to the same organization
        OrganizationUser.objects.create(organization=org, user=self.active_user)

        job.run()

        # Verify it was not deleted because user_count > 1
        self.assertTrue(Organization.objects.filter(id=org.id).exists())

    def test_keeps_org_if_user_inactive_but_not_fully_removed(self):
        """
        Test that an organization is kept if the user is inactive (is_active=False)
        but does not have a date_removed set
        """
        suspended_user = User.objects.create_user(
            username='suspended_user', password='password'
        )
        suspended_user.is_active = False
        suspended_user.save()

        org = self._create_organization_for_user(suspended_user, 'Suspended User Org')

        job.run()
        self.assertTrue(Organization.objects.filter(id=org.id).exists())

    def _create_organization_for_user(self, user, name='Test Org'):
        org = Organization.objects.create(name=name)
        org_user = OrganizationUser.objects.create(organization=org, user=user)
        OrganizationOwner.objects.create(organization=org, organization_user=org_user)
        return org
