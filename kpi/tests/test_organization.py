from django.test import TestCase
from model_bakery import baker

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kobo.apps.organizations.constants import (
    ADMIN_ORG_ROLE,
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
        self.organization.add_user(self.user)
        self.organization.add_user(anotheruser, is_admin=True)
        self.organization.add_user(alice)
        assert self.organization.get_user_role(self.user) == OWNER_ORG_ROLE
        assert self.organization.get_user_role(anotheruser) == ADMIN_ORG_ROLE
        assert self.organization.get_user_role(alice) == MEMBER_ORG_ROLE
