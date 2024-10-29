from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.constants import (
    ORG_ADMIN_ROLE,
    ORG_EXTERNAL_ROLE,
    ORG_MEMBER_ROLE,
    ORG_OWNER_ROLE,
)


class OrganizationTestCase(TestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        # someuser is the only member their organization, and the owner as well.
        self.organization = self.someuser.organization
        self.organization.mmo_override = True
        self.organization.save(update_fields=['mmo_override'])

    def test_owner_user_object_property(self):
        anotheruser = User.objects.get(username='anotheruser')
        self.organization.add_user(anotheruser)
        assert self.organization.owner_user_object == self.someuser

    def test_get_user_role(self):
        anotheruser = User.objects.get(username='anotheruser')
        alice = User.objects.create(username='alice', email='alice@alice.com')
        external = User.objects.create(
            username='external', email='external@external.com'
        )
        self.organization.add_user(anotheruser, is_admin=True)
        self.organization.add_user(alice)
        assert self.organization.get_user_role(self.someuser) == ORG_OWNER_ROLE
        assert self.organization.get_user_role(anotheruser) == ORG_ADMIN_ROLE
        assert self.organization.get_user_role(alice) == ORG_MEMBER_ROLE
        assert self.organization.get_user_role(external) == ORG_EXTERNAL_ROLE

    def test_create_organization_on_user_creation(self):
        assert not Organization.objects.filter(name__startswith='alice').exists()
        organization_count = Organization.objects.all().count()
        User.objects.create_user(
            username='alice', password='alice', email='alice@alice.com'
        )
        assert Organization.objects.filter(name__startswith='alice').exists()
        assert Organization.objects.all().count() == organization_count + 1

    def test_sync_org_name_on_save(self):
        """
        Tests the synchronization of the organization name with the metadata in
        ExtraUserDetail upon saving.

        This synchronization should only occur if the user is the owner of the
        organization.
        """
        # someuser is the owner
        assert self.organization.name == 'someuser’s organization'
        someuser_extra_details = self.someuser.extra_details
        someuser_extra_details.data['organization'] = 'SomeUser Technologies'
        someuser_extra_details.save()
        self.organization.refresh_from_db()
        assert self.organization.name == 'SomeUser Technologies'

        # another is an admin
        anotheruser = User.objects.get(username='anotheruser')

        self.organization.add_user(anotheruser, is_admin=True)
        anotheruser_extra_details = anotheruser.extra_details
        anotheruser_extra_details.data['organization'] = 'AnotherUser Enterprises'
        anotheruser_extra_details.save()
        self.organization.refresh_from_db()
        assert self.organization.name == 'SomeUser Technologies'
