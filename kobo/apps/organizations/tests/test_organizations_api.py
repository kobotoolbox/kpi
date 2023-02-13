from django.contrib.auth.models import User
from django.urls import reverse

from model_bakery import baker
from rest_framework import status

from kobo.apps.organizations.models import Organization
from kpi.tests.kpi_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE


class OrganizationTestCase(BaseTestCase):

    fixtures = ['test_data']
    URL_NAMESPACE = URL_NAMESPACE

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.client.force_login(self.user)
        self.url_list = reverse(self._get_endpoint('organizations-list'))

    def _insert_data(self):
        self.organization = baker.make(Organization, uid='org_abcd1234')
        self.organization.add_user(user=self.user, is_admin=True)
        self.url_detail = reverse(
            self._get_endpoint('organizations-detail'),
            kwargs={'uid': self.organization.uid},
        )

    def test_anonymous_user(self):
        self._insert_data()
        self.client.logout()
        response_list = self.client.get(self.url_list)
        assert response_list.status_code == status.HTTP_403_FORBIDDEN
        response_detail = self.client.get(self.url_detail)
        assert response_detail.status_code == status.HTTP_403_FORBIDDEN

    def test_api_creates_org(self):
        self.assertFalse(self.user.organizations_organization.all())
        self.client.get(self.url_list)
        self.assertTrue(self.user.organizations_organization.all())

    def test_api_returns_org_data(self):
        self._insert_data()
        response = self.client.get(self.url_detail)
        self.assertContains(response, self.organization.slug)
        self.assertContains(response, self.organization.uid)
        self.assertContains(response, self.organization.name)
