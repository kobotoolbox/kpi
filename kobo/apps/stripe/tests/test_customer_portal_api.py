from unittest.mock import patch
from urllib.parse import urlencode

from django.urls import reverse
from djstripe.models import Customer, Price, Product, Subscription
from model_bakery import baker
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kpi.tests.kpi_test_case import BaseTestCase


@patch('djstripe.models.Customer.objects.get')
@patch('stripe.billing_portal.Session.create')
@patch('stripe.billing_portal.Configuration.list')
@patch('stripe.billing_portal.Configuration.create')
class TestCustomerPortalAPITestCase(BaseTestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.some_user = User.objects.get(username='someuser')
        self.client.force_login(self.some_user)

    @staticmethod
    def _get_url(query_params):
        url = reverse('portallinks')
        return f'{url}?{urlencode(query_params)}'

    def _create_stripe_data(self, create_subscription=True, product_type='plan'):
        self.organization = baker.make(
            Organization, id='orgSALFMLFMSDGmgdlsgmsd', mmo_override=True
        )
        self.customer = baker.make(
            Customer, subscriber=self.organization, livemode=False
        )
        self.product = baker.make(Product, metadata={'product_type': product_type})
        self.price = baker.make(
            Price,
            product=self.product,
        )
        if create_subscription:
            self.subscription = baker.make(
                Subscription,
                status='active',
                customer=self.customer,
                items__price=self.price
            )

    def _get_url_for_expected_request(self, create_subscription=True, product_type='plan'):
        self._create_stripe_data(create_subscription, product_type)
        self.organization.add_user(self.some_user, is_admin=True)
        return self._get_url({'organization_id': self.organization.id, 'price_id': self.price.id})

    def test_generates_url(self, create_config, list_config, session_create, get_customer):
        session_create.return_value = {'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'}
        url = self._get_url_for_expected_request()
        list_config.return_value = [
            {
                'id': 'test config',
                'is_default': True,
                'active': True,
                'livemode': False,
            },
        ]
        response = self.client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['url'].startswith('https://billing.stripe.com/')

    def test_needs_organization_id(self, create_config, list_config, session_create, get_customer):
        session_create.return_value = {'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'}
        url = self._get_url({'organization_id': ''})
        response = self.client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_user_must_be_owner(self, create_config, list_config, session_create, get_customer):
        session_create.return_value = {'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'}
        self._create_stripe_data()
        get_customer.return_value = self.customer
        url = self._get_url({'organization_id': self.organization.id})
        response = self.client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_gets_portal_configuration_for_price(self, create_config, list_config, session_create, get_customer):
        """
        If the billing portal isn't configured to switch to the price provided,
        it first tries to get a matching portal from Stripe. Test that this works
        correctly with a dummy billing configuration.
        """
        session_create.return_value = {'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'}
        url = self._get_url_for_expected_request(product_type='addon')
        list_config.return_value = [
            {
                'id': 'test',
                'active': True,
                'is_default': True,
                'livemode': False,
                'features': {
                    'subscription_update': {
                        'default_allowed_updates': ['quantity'],
                        'products': [],
                        'prices': [],
                    },
                },
                'business_profile': None,
                'metadata': {
                    'portal_price': self.price.id,
                },
            },
        ]
        create_config.return_value = {'id': 'test'}
        response = self.client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['url'].startswith('https://billing.stripe.com/')

    def test_generates_portal_configuration(self, create_config, list_config, session_create, get_customer):
        """
        If there isn't a matching portal configuration for the price in Stripe,
        the endpoint attempts to create a new one. Test that nothing breaks, using a dummy config.
        """
        session_create.return_value = {'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'}
        url = self._get_url_for_expected_request(product_type='addon')
        list_config.return_value = [
            {
                'id': 'test',
                'metadata': {
                    'portal_price': 'nope',
                },
                'features': {
                    'subscription_update': {
                        'products': []
                    }
                },
                'business_profile': None,
                'is_default': True,
                'active': True,
                'livemode': False,
            },
        ]
        create_config.return_value = {'id': 'test'}
        response = self.client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['url'].startswith('https://billing.stripe.com/')

    def test_generates_link_without_price(self, create_config, list_config, session_create, get_customer):
        session_create.return_value = {'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'}
        self._create_stripe_data()
        self.organization.add_user(self.some_user, is_admin=True)
        url = self._get_url({'organization_id': self.organization.id})
        list_config.return_value = [
            {
                'metadata': {
                    'portal_price': self.price.id,
                },
            },
        ]
        response = self.client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['url'].startswith('https://billing.stripe.com/')

    def test_anonymous_user(self, create_config, list_config, session_create, get_customer):
        session_create.return_value = {'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'}
        url = self._get_url_for_expected_request()
        self.client.logout()
        response = self.client.post(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
