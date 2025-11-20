# coding: utf-8
from django.test import TestCase
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization


class UserDetailTestCase(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')

    def test_user_automatically_has_extra_user_details(self):
        """
        See the calls to `standardize_json_field()` in `ExtraUserDetail.save()`
        for an explanation of why `name` and `organization` are present for
        brand-new users
        """
        self.assertEqual(
            self.user.extra_details.data, {'name': '', 'organization': ''}
        )

    def test_user_details_can_be_set(self):
        some_details = {
            'name': '',
            'organization': '',
            'value1': 123,
            'value2': 456,
        }
        self.assertEqual(
            self.user.extra_details.data, {'name': '', 'organization': ''}
        )
        self.user.extra_details.data = some_details
        self.user.extra_details.save()
        self.assertEqual(self.user.extra_details.data, some_details)

    def test_user_details_can_be_updated(self):
        some_details = {
            'name': '',
            'organization': '',
            'value1': 'abc',
            'value2': False,
        }
        self.assertEqual(
            self.user.extra_details.data, {'name': '', 'organization': ''}
        )
        self.user.extra_details.data.update(some_details)
        self.user.extra_details.save()
        self.assertEqual(self.user.extra_details.data, some_details)


class UserOrganizationCreationTestCase(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')

        # Delete the existing organization
        Organization.objects.filter(
            organization_users__user=self.user
        ).delete()

    def test_no_org_created_when_user_removed(self):
        """
        When a user is marked as removed (extra_details.date_removed is set),
        accessing user.organization should NOT create an Organization
        """
        before_count = Organization.objects.filter(
            organization_users__user=self.user
        ).count()
        self.assertEqual(before_count, 0)

        # Simulate the user being removed (trash emptied)
        self.user.extra_details.date_removed = timezone.now()
        self.user.extra_details.save(update_fields=['date_removed'])

        # Access property, should return None and NOT create an Organization
        self.assertIsNone(self.user.organization)

        after_count = Organization.objects.filter(
            organization_users__user=self.user
        ).count()
        self.assertEqual(after_count, 0)

    def test_no_org_created_when_user_inactive(self):
        """
        If a user is inactive (is_active == False), accessing user.organization
        should NOT create an Organization.
        """
        before_count = Organization.objects.filter(
            organization_users__user=self.user
        ).count()
        self.assertEqual(before_count, 0)

        # Make user inactive and save
        self.user.is_active = False
        self.user.save(update_fields=['is_active'])

        # Access property,should return None and NOT create an Organization
        self.assertIsNone(self.user.organization)

        after_count = Organization.objects.filter(
            organization_users__user=self.user
        ).count()
        self.assertEqual(after_count, 0)
