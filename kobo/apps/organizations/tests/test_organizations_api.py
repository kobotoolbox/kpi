from django.urls import reverse
from model_bakery import baker
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kpi.tests.kpi_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE

from kpi.utils.fuzzy_int import FuzzyInt


class OrganizationTestCase(BaseTestCase):
    fixtures = ['test_data']
    URL_NAMESPACE = URL_NAMESPACE

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.client.force_login(self.user)
        self.url_list = reverse(self._get_endpoint('organizations-list'))

    def _insert_data(self):
        self.organization = baker.make(Organization, id='org_abcd1234')
        self.organization.add_user(user=self.user, is_admin=True)
        self.url_detail = reverse(
            self._get_endpoint('organizations-detail'),
            kwargs={'id': self.organization.id},
        )

    def test_anonymous_user(self):
        self._insert_data()
        self.client.logout()
        response_list = self.client.get(self.url_list)
        assert response_list.status_code == status.HTTP_401_UNAUTHORIZED
        response_detail = self.client.get(self.url_detail)
        assert response_detail.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create(self):
        data = {'name': 'my org'}
        res = self.client.post(self.url_list, data)
        self.assertContains(res, data['name'], status_code=201)

    def test_list(self):
        self._insert_data()
        organization2 = baker.make(Organization, id='org_abcd123')
        organization2.add_user(user=self.user, is_admin=True)
        with self.assertNumQueries(FuzzyInt(8, 10)):
            res = self.client.get(self.url_list)
        self.assertContains(res, organization2.name)

    def test_list_creates_org(self):
        self.assertFalse(self.user.organizations_organization.all())
        self.client.get(self.url_list)
        self.assertTrue(self.user.organizations_organization.all())

    def test_api_returns_org_data(self):
        self._insert_data()
        response = self.client.get(self.url_detail)
        self.assertContains(response, self.organization.slug)
        self.assertContains(response, self.organization.id)
        self.assertContains(response, self.organization.name)

    def test_update(self):
        self._insert_data()
        data = {'name': 'edit'}
        with self.assertNumQueries(FuzzyInt(8, 10)):
            res = self.client.patch(self.url_detail, data)
        self.assertContains(res, data['name'])

        user = baker.make(User)
        self.client.force_login(user)
        org_user = self.organization.add_user(user=user)
        res = self.client.patch(self.url_detail, data)
        self.assertEqual(res.status_code, 403)
