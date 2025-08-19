import stripe
from kobo.apps.kobo_auth.shortcuts import User
from django.urls import reverse

from djstripe.models import Customer, Price, Product
from model_bakery import baker
from rest_framework import status
from urllib.parse import urlencode
from unittest.mock import patch

from kobo.apps.organizations.models import Organization
from kpi.tests.kpi_test_case import BaseTestCase


class TestCheckoutLinkAPITestCase(BaseTestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.client.force_login(self.someuser)
        product = baker.prepare(
            Product, metadata={'product_type': 'plan'}, active=True
        )
        product.save()
        self.price = baker.make(
            Price,
            active=True,
            id='price_1LsSOSAR39rDI89svTKog9Hq',
            product=product,
            metadata={"max_purchase_quantity": "3"},
        )

    @staticmethod
    def _get_url(query_params):
        url = reverse('checkoutlinks')
        return f'{url}?{urlencode(query_params)}'

    def _create_customer_organization(self):
        organization = baker.make(Organization, id='orgSALFMLFMSDGmgdlsgmsd')
        customer = baker.make(Customer, subscriber=organization)
        return customer, organization

    @patch("djstripe.models.Customer.sync_from_stripe_data")
    @patch("stripe.Customer.modify")
    @patch("djstripe.models.Customer.get_or_create")
    @patch("stripe.checkout.Session.create")
    def generate_url(
        self, query_params, stripe_checkout_session_create_mock, customer_get_or_create_mock, modify_customer_mock, stripe_sync_mock
    ):
        customer_get_or_create_mock.return_value = (Customer, False)
        modify_customer_mock.return_value = Customer
        stripe_checkout_session_create_mock.return_value = {'url': 'https://checkout.stripe.com/c/pay/cs_test_a1NbsdWp'}
        stripe_sync_mock.return_value = None

        customer, organization = self._create_customer_organization()
        organization.add_user(self.someuser, is_admin=True)
        url = self._get_url(
            {
                'price_id': self.price.id,
                'organization_id': organization.id,
                **query_params,
            }
        )
        return self.client.post(url)

    def test_generates_url_for_price_without_quantity(self):
        response = self.generate_url({})
        assert response.status_code == status.HTTP_200_OK
        assert response.data['url'].startswith('https://checkout.stripe.com')

    def test_generates_url_for_price_with_quantity(self):
        response = self.generate_url({'quantity': 100000})
        assert response.status_code == status.HTTP_200_OK
        assert response.data['url'].startswith('https://checkout.stripe.com')

    def test_rejects_invalid_query_params(self):
        response = self.generate_url({'price_id': 'test', 'organization_id': 'test'})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @patch("djstripe.models.Customer.sync_from_stripe_data")
    @patch("stripe.Customer.modify")
    @patch("djstripe.models.Customer.get_or_create")
    @patch("stripe.checkout.Session.create")
    def test_creates_organization(
        self, stripe_checkout_session_create_mock, customer_get_or_create_mock, modify_customer_mock, stripe_sync_mock
    ):
        stripe_sync_mock.return_value = None
        modify_customer_mock.return_value = Customer
        customer_get_or_create_mock.return_value = (Customer, False)
        stripe_checkout_session_create_mock.return_value = {'url': 'https://checkout.stripe.com/c/pay/cs_test_a1NbsdWp'}
        url = self._get_url({'price_id': self.price.id})
        response = self.client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['url'].startswith('https://checkout.stripe.com')
        assert Organization.objects.filter(organization_users__user_id=self.someuser).last()

    def test_anonymous_user(self):
        self.client.logout()
        response = self.generate_url({})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
