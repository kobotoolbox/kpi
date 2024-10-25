from django.test import TestCase
from model_bakery import baker

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.constants import (
    ADMIN_ORG_ROLE,
    EXTERNAL_ORG_ROLE,
    MEMBER_ORG_ROLE,
    OWNER_ORG_ROLE,
)


class OrganizationTestCase(TestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.organization = baker.make(
            Organization,
            id='orgSALFMLFMSDGmgdlsgmsd',
            slug='orgSALFMLFMSDGmgdlsgmsd',
        )

    def test_owner_user_object_property(self):
        # The organization has no members yet, the first user is set as the owner
        self.organization.add_user(self.user)
        anotheruser = User.objects.get(username='anotheruser')
        self.organization.add_user(anotheruser)
        assert self.organization.owner_user_object == self.user
        assert not (self.organization.owner_user_object == anotheruser)

    def test_no_owner_user_object_property(self):
        assert self.organization.owner_user_object is None

    def test_get_user_role(self):
        anotheruser = User.objects.get(username='anotheruser')
        alice = User.objects.create(username='alice', email='alice@alice.com')
        external = User.objects.create(
            username='external', email='external@external.com'
        )
        self.organization.add_user(self.user)
        self.organization.add_user(anotheruser, is_admin=True)
        self.organization.add_user(alice)
        assert self.organization.get_user_role(self.user) == OWNER_ORG_ROLE
        assert self.organization.get_user_role(anotheruser) == ADMIN_ORG_ROLE
        assert self.organization.get_user_role(alice) == MEMBER_ORG_ROLE
        assert self.organization.get_user_role(external) == EXTERNAL_ORG_ROLE

    def test_create_organization_on_user_creation(self):
        assert not Organization.objects.filter(name__startswith='alice').exists()
        organization_count = Organization.objects.all().count()
        User.objects.create_user(
            username='alice', password='alice', email='alice@alice.com'
        )
        assert Organization.objects.filter(name__startswith='alice').exists()
        assert Organization.objects.all().count().count() == organization_count + 1

    def test_sync_org_name_on_save(self):
        """
        Tests the synchronization of the organization name with the metadata in
        ExtraUserDetail upon saving.

        This synchronization should only occur if the user is the owner of the
        organization.
        """

        self.organization.add_user(self.user)
        # someuser is the owner
        assert self.organization.name == 'someuser’s organization'
        some_extra_details = self.user.extra_details
        some_extra_details.data['organization'] = 'SomeUser Technologies'
        some_extra_details.save()
        assert self.organization.name == 'Someuser Technologies'

        # another is an admin
        anotheruser = User.objects.get(username='anotheruser')

        self.organization.add_user(anotheruser, is_admin=True)
        some_extra_details = self.user.extra_details
        some_extra_details.data['organization'] = 'AnotherUser Enterprises'
        some_extra_details.save()
        assert self.organization.name == 'Someuser Technologies'
