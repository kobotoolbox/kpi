from unittest.mock import patch
from urllib.parse import urlencode

from django.conf import settings
from django.urls import reverse
from django.utils import timezone
from djstripe.models import Customer, Price, Product, Subscription
from djstripe.settings import djstripe_settings
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
            now = timezone.now()
            self.subscription = baker.make(
                Subscription,
                status='active',
                customer=self.customer,
                items__price=self.price,
                livemode=False,
                billing_cycle_anchor=now,
                current_period_start=now,
                current_period_end=now + timezone.timedelta(days=30),
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
                        'default_allowed_updates': [],
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

    def test_get_billing_details_success(
        self, create_config, list_config, session_create, get_customer
    ):
        session_create.return_value = {
            'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'
        }
        self._create_stripe_data(create_subscription=True)
        self.customer.name = 'Test Org Customer'
        self.customer.email = 'billing@example.com'
        self.customer.phone = '+1234567890'
        self.customer.address = {
            'city': 'New York',
            'country': 'US',
            'line1': '123 Test St',
            'line2': 'Apt 4B',
            'postal_code': '10001',
            'state': 'NY',
        }
        self.customer.balance = 500
        self.customer.currency = 'usd'
        self.customer.save()
        self.organization.add_user(self.some_user)

        url = self._get_url({'organization_id': self.organization.id})
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = response.data
        assert data['id'] == self.customer.id
        assert data['name'] == 'Test Org Customer'
        assert data['email'] == 'billing@example.com'
        assert data['phone'] == '+1234567890'
        assert data['address'] == {
            'city': 'New York',
            'country': 'US',
            'line1': '123 Test St',
            'line2': 'Apt 4B',
            'postal_code': '10001',
            'state': 'NY',
        }
        assert data['balance'] == 500
        assert data['currency'] == 'usd'
        assert data['url'] == 'https://billing.stripe.com/p/session/test_YWNjdF8x'
        assert data['billing_cycle_info']['status'] == 'active'
        assert data['billing_cycle_info']['billing_cycle_anchor'] is not None
        session_create.assert_called_once_with(
            api_key=djstripe_settings.STRIPE_SECRET_KEY,
            customer=self.customer.id,
            return_url=f'{settings.KOBOFORM_URL}/#/account/plan',
        )

    def test_get_billing_details_for_canceled_subscription(
        self, create_config, list_config, session_create, get_customer
    ):
        session_create.return_value = {
            'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'
        }
        self._create_stripe_data(create_subscription=False)
        self.subscription = baker.make(
            Subscription,
            status='canceled',
            customer=self.customer,
            items__price=self.price,
            livemode=False,
        )
        self.organization.add_user(self.some_user)

        url = self._get_url({'organization_id': self.organization.id})
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['billing_cycle_info']['status'] == 'canceled'
        assert (
            response.data['url'] == 'https://billing.stripe.com/p/session/test_YWNjdF8x'
        )
        session_create.assert_called_once_with(
            api_key=djstripe_settings.STRIPE_SECRET_KEY,
            customer=self.customer.id,
            return_url=f'{settings.KOBOFORM_URL}/#/account/plan',
        )

    def test_get_billing_details_forbidden_for_non_owner(
        self, create_config, list_config, session_create, get_customer
    ):
        session_create.return_value = {
            'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'
        }
        self._create_stripe_data()
        other_user = User.objects.get(username='anotheruser')
        self.organization.add_user(other_user)  # other_user becomes the owner
        self.organization.add_user(
            self.some_user, is_admin=True
        )  # some_user is admin, not owner

        url = self._get_url({'organization_id': self.organization.id})
        response = self.client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_billing_details_unauthenticated(
        self, create_config, list_config, session_create, get_customer
    ):
        self._create_stripe_data()
        self.organization.add_user(self.some_user)
        self.client.logout()

        url = self._get_url({'organization_id': self.organization.id})
        response = self.client.get(url)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_billing_details_missing_customer(
        self, create_config, list_config, session_create, get_customer
    ):
        organization = baker.make(
            Organization, id='orgNOMATCHCUST1234567890', mmo_override=True
        )
        organization.add_user(self.some_user)

        url = self._get_url({'organization_id': organization.id})
        response = self.client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_billing_details_invalid_organization_id(
        self, create_config, list_config, session_create, get_customer
    ):
        url = self._get_url({'organization_id': 'invalid_id_not_starting_with_org'})
        response = self.client.get(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_get_billing_details_organization_not_found(
        self, create_config, list_config, session_create, get_customer
    ):
        url = self._get_url({'organization_id': 'orgNONEXISTENT123456789'})
        response = self.client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_billing_details_ignores_newer_addon_subscription(
        self, create_config, list_config, session_create, get_customer
    ):
        session_create.return_value = {
            'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'
        }
        self._create_stripe_data(create_subscription=True, product_type='plan')
        self.price.recurring = {'interval': 'month'}
        self.price.save()

        now = timezone.now()
        self.subscription.start_date = now - timezone.timedelta(days=30)
        self.subscription.save()

        # Newer addon subscription
        addon_product = baker.make(Product, metadata={'product_type': 'addon'})
        addon_price = baker.make(
            Price, product=addon_product, recurring={'interval': 'year'}
        )
        baker.make(
            Subscription,
            status='active',
            customer=self.customer,
            items__price=addon_price,
            livemode=False,
            start_date=now - timezone.timedelta(days=2),
            billing_cycle_anchor=now - timezone.timedelta(days=2),
            current_period_start=now - timezone.timedelta(days=2),
            current_period_end=now + timezone.timedelta(days=363),
        )

        self.organization.add_user(self.some_user)

        url = self._get_url({'organization_id': self.organization.id})
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['billing_cycle_info']['interval'] == 'month'
        session_create.assert_called_once_with(
            api_key=djstripe_settings.STRIPE_SECRET_KEY,
            customer=self.customer.id,
            return_url=f'{settings.KOBOFORM_URL}/#/account/plan',
        )

    def test_get_billing_details_prefers_active_plan_over_newer_canceled_plan(
        self, create_config, list_config, session_create, get_customer
    ):
        session_create.return_value = {
            'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'
        }
        self._create_stripe_data(create_subscription=True, product_type='plan')
        now = timezone.now()
        self.subscription.start_date = now - timezone.timedelta(days=60)
        self.subscription.save()

        # Newer canceled plan subscription
        canceled_plan_product = baker.make(Product, metadata={'product_type': 'plan'})
        canceled_plan_price = baker.make(Price, product=canceled_plan_product)
        baker.make(
            Subscription,
            status='canceled',
            customer=self.customer,
            items__price=canceled_plan_price,
            livemode=False,
            start_date=now - timezone.timedelta(days=5),
        )

        self.organization.add_user(self.some_user)

        url = self._get_url({'organization_id': self.organization.id})
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['billing_cycle_info']['status'] == 'active'
        session_create.assert_called_once_with(
            api_key=djstripe_settings.STRIPE_SECRET_KEY,
            customer=self.customer.id,
            return_url=f'{settings.KOBOFORM_URL}/#/account/plan',
        )
