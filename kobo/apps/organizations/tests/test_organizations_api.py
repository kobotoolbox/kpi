from unittest.mock import patch

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
    DEFAULT_SUBSCRIPTION_DETAILS = {
        'current_period_start': '2024-01-01',
        'current_period_end': '2024-12-31'
    }

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.client.force_login(self.user)
        self.url_list = reverse(self._get_endpoint('organizations-list'))

    def _insert_data(self, mmo_override=False):
        self.organization = baker.make(
            Organization,
            id='org_abcd1234',
            mmo_override=mmo_override
        )
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
        with self.assertNumQueries(FuzzyInt(10, 16)):
            res = self.client.get(self.url_list)
        self.assertContains(res, self.organization.name)

    def test_api_returns_org_data(self):
        self._insert_data()
        response = self.client.get(self.url_detail)
        self.assertContains(response, self.organization.slug)
        self.assertContains(response, self.organization.id)
        self.assertContains(response, self.organization.name)

    def test_update(self):
        self._insert_data()
        data = {'name': 'edit'}
        with self.assertNumQueries(FuzzyInt(10, 16)):
            res = self.client.patch(self.url_detail, data)
        self.assertContains(res, data['name'])

        user = baker.make(User)
        self.client.force_login(user)
        self.organization.add_user(user=user)
        res = self.client.patch(self.url_detail, data)
        self.assertEqual(res.status_code, 403)

    def test_api_response_includes_is_mmo_with_mmo_override(self):
        """
        Test that is_mmo is True when mmo_override is enabled and there is no
        active subscription.
        """
        self._insert_data(mmo_override=True)
        response = self.client.get(self.url_detail)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['is_mmo'], True)

    @patch.object(
        Organization,
        'active_subscription_billing_details',
        return_value=DEFAULT_SUBSCRIPTION_DETAILS
    )
    def test_api_response_includes_is_mmo_with_subscription(
        self, mock_active_subscription
    ):
        """
        Test that is_mmo is True when there is an active subscription.
        """
        self._insert_data(mmo_override=False)
        response = self.client.get(self.url_detail)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['is_mmo'], True)

    @patch.object(
        Organization,
        'active_subscription_billing_details',
        return_value=None
    )
    def test_api_response_includes_is_mmo_with_no_override_and_no_subscription(
        self, mock_active_subscription
    ):
        """
        Test that is_mmo is False when neither mmo_override nor active
        subscription is present.
        """
        self._insert_data(mmo_override=False)
        response = self.client.get(self.url_detail)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['is_mmo'], False)

    @patch.object(
        Organization,
        'active_subscription_billing_details',
        return_value=DEFAULT_SUBSCRIPTION_DETAILS
    )
    def test_api_response_includes_is_mmo_with_override_and_subscription(
        self, mock_active_subscription
    ):
        """
        Test that is_mmo is True when both mmo_override and active
        subscription are present.
        """
        self._insert_data(mmo_override=True)
        response = self.client.get(self.url_detail)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['is_mmo'], True)
