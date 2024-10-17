from django.test import TestCase
from model_bakery import baker

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization


class UserTestCase(TestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.organization = baker.make(
            Organization,
            id='orgSALFMLFMSDGmgdlsgmsd',
            slug='orgSALFMLFMSDGmgdlsgmsd',
        )

    def test_is_org_owner(self):
        # The organization has no members yet, the first user is set as the owner
        self.organization.add_user(self.user)
        assert self.user.organization == self.organization
        assert self.user.is_org_owner

    def test_is_not_org_owner(self):
        # The organization has no members yet, the first user is set as the owner
        anotheruser = User.objects.get(username='anotheruser')
        self.organization.add_user(self.user)
        self.organization.add_user(anotheruser)

        assert anotheruser.organization == self.organization
        assert not anotheruser.is_org_owner
