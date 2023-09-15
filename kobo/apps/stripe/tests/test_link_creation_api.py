import stripe

from django.contrib.auth.models import User
from django.urls import reverse

from djstripe.models import Customer, Price, Product
from model_bakery import baker
from rest_framework import status
from urllib.parse import urlencode
from unittest.mock import patch

from kobo.apps.organizations.models import Organization
from kpi.tests.kpi_test_case import BaseTestCase


@patch("djstripe.models.Customer.get_or_create")
@patch("stripe.checkout.Session.create")
class TestCheckoutLinkAPITestCase(BaseTestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.client.force_login(self.someuser)
        product = baker.prepare(Product, active=True)
        product.save()
        self.price =  baker.make(Price, active=True, id='price_1LsSOSAR39rDI89svTKog9Hq', product=product)

    @staticmethod
    def _get_url(query_params):
        url = reverse('checkoutlinks')
        return f'{url}?{urlencode(query_params)}'

    def _create_customer_organization(self):
        organization = baker.make(Organization, id='orgSALFMLFMSDGmgdlsgmsd')
        customer = baker.make(Customer, subscriber=organization)
        return customer, organization

    def test_generates_url(
        self, stripe_checkout_session_create_mock, customer_get_or_create_mock
    ):
        customer, organization = self._create_customer_organization()
        organization.add_user(self.someuser, is_admin=True)
        customer_get_or_create_mock.return_value = (Customer, False)
        stripe_checkout_session_create_mock.return_value = {'url': 'https://checkout.stripe.com/c/pay/cs_test_a1NbsdWp'}
        url = self._get_url({'price_id': self.price.id, 'organization_id': organization.id})
        response = self.client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['url'].startswith('https://checkout.stripe.com')

    def test_rejects_invalid_query_params(
        self, stripe_checkout_session_create_mock, customer_get_or_create_mock
    ):
        stripe_checkout_session_create_mock.return_value = {'url': 'https://checkout.stripe.com/c/pay/cs_test_a1NbsdWp'}
        url = self._get_url({'price_id': 'test', 'organization_id': 'test'})
        response = self.client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_creates_organization(self, stripe_checkout_session_create_mock, customer_get_or_create_mock):
        customer_get_or_create_mock.return_value = (Customer, False)
        stripe_checkout_session_create_mock.return_value = {'url': 'https://checkout.stripe.com/c/pay/cs_test_a1NbsdWp'}
        url = self._get_url({'price_id': self.price.id})
        response = self.client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['url'].startswith('https://checkout.stripe.com')
        assert Organization.objects.filter(organization_users__user_id=self.someuser).last()

    def test_anonymous_user(self, stripe_checkout_session_create_mock, customer_get_or_create_mock):
        self.client.logout()
        response = self.client.post(reverse('checkoutlinks'))
        assert response.status_code == status.HTTP_403_FORBIDDEN
