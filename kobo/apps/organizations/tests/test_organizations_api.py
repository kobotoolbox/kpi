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
        self.someuser = User.objects.get(username='someuser')
        self.client.force_login(self.someuser)
        self.url_list = reverse(self._get_endpoint('organizations-list'))

    def _insert_data(self):
        self.organization = baker.make(Organization, uid='org_abcd1234')
        self.organization.add_user(user=self.someuser, is_admin=True)
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
        self.client.force_login(User.objects.get(username='anotheruser'))
        response_list = self.client.get(self.url_list)
        # assert response_list.status_code == status.HTTP_403_FORBIDDEN
        # org_uid = response_list.data['results'][0]['uid']
        # response_detail = self.client.get(
        #     reverse(
        #         self._get_endpoint('organizations-detail'),
        #         kwargs={'uid': org_uid},
        #     )
        # )
        # assert response_detail.status_code == status.HTTP_200_OK

    def test_api_returns_org_data(self):
        self._insert_data()
        response_detail = self.client.get(self.url_detail)
        assert response_detail.data['slug'] == self.organization.slug
        assert response_detail.data['uid'] == self.organization.uid
        assert response_detail.data['name'] == self.organization.name
        assert response_detail.data['is_active'] == self.organization.is_active
