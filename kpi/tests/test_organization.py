from django.test import TestCase
from model_bakery import baker

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization


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
        assert not self.organization.owner_user_object == anotheruser

    def test_no_owner_user_object_property(self):
        assert self.organization.owner_user_object is None
