from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.constants import (
    ORG_ADMIN_ROLE,
    ORG_EXTERNAL_ROLE,
    ORG_MEMBER_ROLE,
    ORG_OWNER_ROLE,
)
from kobo.apps.organizations.models import Organization


class OrganizationTestCase(TestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        # someuser is the only member their organization, and the owner as well.
        self.organization = self.someuser.organization
        self.organization.mmo_override = True
        self.organization.website = 'https://someuser.org/'
        self.organization.organization_type = 'non-profit'
        self.organization.save()

        self.anotheruser = User.objects.get(username='anotheruser')

    def test_owner_user_object_property(self):
        self.organization.add_user(self.anotheruser)
        assert self.organization.owner_user_object == self.someuser

    def test_get_user_role(self):
        alice = User.objects.create(username='alice', email='alice@alice.com')
        external = User.objects.create(
            username='external', email='external@external.com'
        )
        self.organization.add_user(self.anotheruser, is_admin=True)
        self.organization.add_user(alice)
        assert self.organization.get_user_role(self.someuser) == ORG_OWNER_ROLE
        assert self.organization.get_user_role(self.anotheruser) == ORG_ADMIN_ROLE
        assert self.organization.get_user_role(alice) == ORG_MEMBER_ROLE
        assert self.organization.get_user_role(external) == ORG_EXTERNAL_ROLE

    def test_get_from_user_id(self):
        org = Organization.get_from_user_id(self.someuser.pk)
        assert org.pk == self.organization.pk

        org = Organization.get_from_user_id(self.anotheruser.pk)
        assert org.pk != self.organization.pk

    def test_create_organization_on_user_creation(self):
        assert not Organization.objects.filter(name__startswith='alice').exists()
        organization_count = Organization.objects.all().count()
        User.objects.create_user(
            username='alice', password='alice', email='alice@alice.com'
        )
        assert Organization.objects.filter(name__startswith='alice').exists()
        assert Organization.objects.all().count() == organization_count + 1

    def test_org_attributes_not_synced_with_mmo(self):
        """
        Tests the synchronization of the organization name with the metadata in
        ExtraUserDetail upon saving.

        This synchronization should only occur if the user is the owner of the
        organization.
        """
        # someuser is the owner

        # Empty the name
        assert self.organization.name == 'someuser’s organization'
        someuser_extra_details = self.someuser.extra_details
        someuser_extra_details.data['organization'] = ''
        someuser_extra_details.save()
        self.organization.refresh_from_db()
        assert self.organization.name == 'someuser’s organization'

        # Update org settings
        someuser_extra_details = self.someuser.extra_details
        someuser_extra_details.data['organization'] = 'SomeUser Technologies'
        someuser_extra_details.data['organization_website'] = 'https://someuser.com/'
        someuser_extra_details.data['organization_type'] = 'commercial'
        someuser_extra_details.save()
        self.organization.refresh_from_db()
        assert self.organization.name == 'someuser’s organization'
        assert self.organization.website == 'https://someuser.org/'
        assert self.organization.organization_type == 'non-profit'

        # another is an admin
        self.organization.add_user(self.anotheruser, is_admin=True)
        anotheruser_extra_details = self.anotheruser.extra_details
        anotheruser_extra_details.data['organization'] = 'AnotherUser Enterprises'
        someuser_extra_details.data['organization_website'] = 'https://anotheruser.com/'
        someuser_extra_details.data['organization_type'] = 'none'
        anotheruser_extra_details.save()
        self.organization.refresh_from_db()
        assert self.organization.name == 'someuser’s organization'
        assert self.organization.website == 'https://someuser.org/'
        assert self.organization.organization_type == 'non-profit'

    def test_org_attributes_synced_without_mmo(self):

        # anotheruser's organization is not mmo
        organization = self.anotheruser.organization
        assert organization.is_mmo is False
        assert organization.website == ''
        assert organization.organization_type == 'none'
        assert organization.name == 'anotheruser’s organization'

        anotheruser_extra_details = self.anotheruser.extra_details
        anotheruser_extra_details.data['organization'] = 'AnotherUser Enterprises'
        anotheruser_extra_details.data['organization_website'] = (
            'https://anotheruser.org/'
        )
        anotheruser_extra_details.data['organization_type'] = 'commercial'
        anotheruser_extra_details.save()
        organization.refresh_from_db()
        assert organization.name == 'AnotherUser Enterprises'
        assert organization.website == 'https://anotheruser.org/'
        assert organization.organization_type == 'commercial'
