from unittest.mock import patch
from urllib.parse import urlencode

from django.urls import reverse
from djstripe.models import Customer, Price, Product, Subscription
from model_bakery import baker
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.kpi_test_case import BaseTestCase


@patch('stripe.billing_portal.Session.create')
@patch('stripe.billing_portal.Configuration.list')
class TestCustomerPortalAPITestCase(BaseTestCase):

    fixtures = ['test_data']

    @classmethod
    def setUpTestData(cls):
        cls.some_user = User.objects.get(username='someuser')
        cls.organization = cls.some_user.organization
        cls.organization.mmo_override = True
        cls.organization.save(update_fields=['mmo_override'])
        cls.customer = baker.make(Customer, subscriber=cls.organization, livemode=False)
        cls.plan_product_1 = baker.make(Product, metadata={'product_type': 'plan'})
        cls.plan_product_1_monthly_price = baker.make(
            Price,
            product=cls.plan_product_1,
            recurring={'interval': 'month', 'interval_count': 1},
            unit_amount=100,
        )
        cls.plan_product_1_annual_price = baker.make(
            Price,
            product=cls.plan_product_1,
            recurring={'interval': 'year', 'interval_count': 1},
            unit_amount=1200,
        )
        cls.plan_product_2 = baker.make(Product, metadata={'product_type': 'plan'})
        cls.plan_product_2_monthly_price = baker.make(
            Price,
            product=cls.plan_product_1,
            recurring={'interval': 'month', 'interval_count': 1},
            unit_amount=200,
        )
        cls.plan_product_2_annual_price = baker.make(
            Price,
            product=cls.plan_product_1,
            recurring={'interval': 'year', 'interval_count': 1},
            unit_amount=2400,
        )
        cls.addon_product = baker.make(Product, metadata={'product_type': 'addon'})
        cls.addon_product_monthly_price = baker.make(
            Price,
            product=cls.addon_product,
            recurring={'interval': 'month', 'interval_count': 1},
            unit_amount=50,
        )
        cls.addon_product_annual_price = baker.make(
            Price,
            product=cls.addon_product,
            recurring={'interval': 'year', 'interval_count': 1},
            unit_amount=600,
        )

    def setUp(self):
        self.client.force_login(self.some_user)

    @staticmethod
    def _get_url(query_params):
        url = reverse('portallinks')
        return f'{url}?{urlencode(query_params)}'

    def test_generates_url(self, list_config, session_create):
        expected_url = 'https://billing.stripe.com/p/session/test_YWNjdF8x'
        session_create.return_value = {'url': expected_url}
        baker.make(
            Subscription,
            status='active',
            customer=self.customer,
            items__price=self.plan_product_1_monthly_price,
        )
        list_config.return_value = [
            {
                'metadata': {'slug': 'manage-standard'},
            },
        ]
        url = self._get_url({'organization_id': self.organization.id})
        response = self.client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['url'] is expected_url

    def test_needs_organization_id(self, list_config, session_create):
        session_create.return_value = {
            'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'
        }
        url = self._get_url({'organization_id': ''})
        response = self.client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_user_must_be_owner(self, list_config, session_create):
        session_create.return_value = {
            'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'
        }
        baker.make(
            Subscription,
            status='active',
            customer=self.customer,
            items__price=self.plan_product_1_monthly_price,
        )
        another_user = User.objects.get(username='anotheruser')
        self.organization.add_user(another_user, is_admin=True)
        self.client.force_login(another_user)
        url = self._get_url({'organization_id': self.organization.id})
        response = self.client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_anonymous_user(
        self,
        list_config,
        session_create,
    ):
        url = self._get_url({'organization_id': self.organization.id})
        self.client.logout()
        response = self.client.post(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_normal_downgrade_config_selection(self, list_config, session_create):
        """
        We generally want downgrades to take place at the end
        of the billing cycle
        """
        session_create.return_value = {
            'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'
        }
        list_config.return_value = [
            {
                'metadata': {'slug': 'switch-plans-delayed-downgrade'},
            },
        ]
        baker.make(
            Subscription,
            status='active',
            customer=self.customer,
            items__price=self.plan_product_2_monthly_price,
        )
        url = self._get_url(
            {
                'organization_id': self.organization.id,
                'price_id': self.plan_product_1_monthly_price.id,
            }
        )
        response = self.client.post(url)
        assert response.status_code == status.HTTP_200_OK

    def test_normal_upgrade_config_selection(self, list_config, session_create):
        """
        Downgrade rules don't actually matter here, since this is an upgrade, but
        we stick with delayed downgrade as a default config.
        """
        session_create.return_value = {
            'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'
        }
        list_config.return_value = [
            {
                'metadata': {'slug': 'switch-plans-delayed-downgrade'},
            },
        ]
        baker.make(
            Subscription,
            status='active',
            customer=self.customer,
            items__price=self.plan_product_2_monthly_price,
        )
        url = self._get_url(
            {
                'organization_id': self.organization.id,
                'price_id': self.plan_product_2_annual_price.id,
            }
        )
        response = self.client.post(url)
        assert response.status_code == status.HTTP_200_OK

    def test_higher_tier_downgrade_config_selection(self, list_config, session_create):
        """
        If a user is switching from a lower tier of service to a higher tier,
        we want them to be able to upgrade immediately even if they are switching from
        an annual plan to a monthly plan.
        """
        session_create.return_value = {
            'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'
        }
        list_config.return_value = [
            {
                'metadata': {'slug': 'switch-plans-immediate-downgrade'},
            },
        ]
        baker.make(
            Subscription,
            status='active',
            customer=self.customer,
            items__price=self.addon_product_annual_price,
        )
        url = self._get_url(
            {
                'organization_id': self.organization.id,
                'price_id': self.plan_product_1_monthly_price.id,
            }
        )
        response = self.client.post(url)
        assert response.status_code == status.HTTP_200_OK

    def test_manage_standard_config_selection(self, list_config, session_create):
        session_create.return_value = {
            'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'
        }
        list_config.return_value = [
            {
                'metadata': {'slug': 'manage-standard'},
            },
        ]
        self.subscription = baker.make(
            Subscription,
            status='active',
            customer=self.customer,
            items__price=self.plan_product_1_monthly_price,
        )
        url = self._get_url({'organization_id': self.organization.id})
        response = self.client.post(url)
        assert response.status_code == status.HTTP_200_OK

    def test_manage_addon_config_selection(
        self,
        list_config,
        session_create,
    ):
        session_create.return_value = {
            'url': 'https://billing.stripe.com/p/session/test_YWNjdF8x'
        }
        list_config.return_value = [
            {
                'metadata': {'slug': 'manage-addon'},
            },
        ]
        self.subscription = baker.make(
            Subscription,
            status='active',
            customer=self.customer,
            items__price=self.addon_product_monthly_price,
        )
        url = self._get_url({'organization_id': self.organization.id})
        response = self.client.post(url)
        assert response.status_code == status.HTTP_200_OK
