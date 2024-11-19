from model_bakery import baker

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kpi.tests.kpi_test_case import BaseTestCase


class OrganizationsModelTestCase(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.organization = baker.make(Organization, id='org_abcd1234')
        self.organization.add_user(user=self.user, is_admin=True)

    def test_get_from_user_id(self):
        org = Organization.get_from_user_id(self.user.pk)
        assert org.pk == self.organization.pk

        org = Organization.get_from_user_id(self.anotheruser.pk)
        assert org.pk != self.organization.pk
