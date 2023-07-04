import stripe

from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from django.urls import reverse

from djstripe.models import Customer
from model_bakery import baker
from rest_framework import status
from urllib.parse import urlencode
from unittest.mock import patch

from kobo.apps.organizations.models import Organization
from kpi.tests.kpi_test_case import BaseTestCase


@patch('djstripe.models.Customer.objects.get')
@patch('stripe.billing_portal.Session.create')
class TestCustomerPortalAPITestCase(BaseTestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.some_user = User.objects.get(username='someuser')
        self.client.force_login(self.some_user)

    @staticmethod
    def _get_url(query_params):
        url = reverse('portallinks')
        return f'{url}?{urlencode(query_params)}'

    def _create_customer_organization(self):
        organization = baker.make(Organization, id='orgSALFMLFMSDGmgdlsgmsd')
        customer = baker.make(Customer, subscriber=organization)
        return customer, organization

    def _post_expected_request(self):
        customer, organization = self._create_customer_organization()
        organization.add_user(self.some_user, is_admin=True)
        url = self._get_url({'organization_id': organization.id})
        return self.client.post(url)

    def test_generates_url(self, stripe_billing_session_create_mock, customer_objects_get_mock):
        stripe_billing_session_create_mock.return_value = {'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'}
        response = self._post_expected_request()
        assert response.status_code == status.HTTP_200_OK
        assert response.data['url'].startswith('https://billing.stripe.com/')

    def test_needs_organization_id(self, stripe_billing_session_create_mock, customer_objects_get_mock):
        stripe_billing_session_create_mock.return_value = {'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'}
        url = self._get_url({'organization_id': ''})
        response = self.client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_user_must_be_owner(self, stripe_billing_session_create_mock, customer_objects_get_mock):
        stripe_billing_session_create_mock.return_value = {'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'}
        customer, organization = self._create_customer_organization()
        customer_objects_get_mock.return_value = customer
        url = self._get_url({'organization_id': organization.id})
        with self.assertRaises(ObjectDoesNotExist):
            self.client.post(url)

    def test_anonymous_user(self, stripe_billing_session_create_mock, customer_objects_get_mock):
        stripe_billing_session_create_mock.return_value = {'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'}
        self.client.logout()
        response = self._post_expected_request()
        assert response.status_code == status.HTTP_403_FORBIDDEN
