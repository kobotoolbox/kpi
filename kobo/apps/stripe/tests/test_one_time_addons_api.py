from ddt import data, ddt
from django.urls import reverse
from django.utils import timezone
from djstripe.models import (
    Charge,
    Customer,
    PaymentIntent,
    Price,
    Product,
    Subscription,
)
from model_bakery import baker
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.constants import USAGE_LIMIT_MAP
from kobo.apps.stripe.models import PlanAddOn
from kpi.tests.kpi_test_case import BaseTestCase


@ddt
class OneTimeAddOnAPITestCase(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.client.force_login(self.someuser)
        self.url = reverse('addons-list')
        self.price_id = 'price_305dfs432ltnjw'
        self.organization = baker.make(Organization)
        self.organization.add_user(self.someuser, is_admin=True)
        self.customer = baker.make(Customer, subscriber=self.organization)
        baker.make(
            Subscription,
            customer=self.customer,
            status='active',
        )

    def _create_customer_with_subscription(self, user):
        organization = baker.make(Organization)
        organization.add_user(user, is_admin=True)
        customer = baker.make(Customer, subscriber=organization)
        baker.make(Subscription, customer=customer, status='active')
        return customer

    def _create_product(self, metadata=None):
        if not metadata:
            metadata = {
                'product_type': 'addon_onetime',
                'submission_limit': 2000,
                'valid_tags': 'all',
            }
        self.product = baker.make(
            Product,
            active=True,
            metadata=metadata,
        )
        self.price = baker.make(
            Price, active=True, product=self.product, type='one_time'
        )
        self.product.save()

    def _create_payment(
        self, payment_status='succeeded', refunded=False, customer=None
    ):
        if customer is None:
            customer = self.customer
        payment_total = 2000
        self.payment_intent = baker.make(
            PaymentIntent,
            customer=customer,
            status=payment_status,
            payment_method_types=['card'],
            livemode=False,
            amount=payment_total,
            amount_capturable=payment_total,
            amount_received=payment_total,
        )
        self.charge = baker.prepare(
            Charge,
            customer=customer,
            refunded=refunded,
            created=timezone.now(),
            payment_intent=self.payment_intent,
            paid=True,
            status=payment_status,
            livemode=False,
            amount_refunded=0 if refunded else payment_total,
            amount=payment_total,
        )
        self.charge.metadata = {
            'price_id': self.price.id,
            'organization_id': customer.subscriber.id,
            **(self.product.metadata or {}),
        }
        self.charge.save()

    def test_no_addons(self):
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['results'] == []

    def test_get_addon(self):
        self._create_product()
        self._create_payment()
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['results'][0]['product'] == self.product.id

    def test_multiple_addons(self):
        self._create_product()
        self._create_payment()
        self._create_payment()
        self._create_payment()
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 3

    def test_no_addons_for_invalid_product_metadata(self):
        self._create_product(
            metadata={'product_type': 'subscription', 'submission_limit': 2000}
        )
        self._create_payment()
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 0

        self._create_product(
            metadata={
                'product_type': 'addon_onetime',
                'not_a_real_limit_key': 2000,
                'valid_tags': 'all',
            }
        )
        self._create_payment()
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 0

    def test_addon_inactive_for_refunded_charge(self):
        self._create_product()
        self._create_payment(refunded=True)
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert not response.data['results'][0]['is_available']

    def test_no_addon_for_cancelled_charge(self):
        self._create_product()
        self._create_payment(payment_status='cancelled')
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 0

    def test_anonymous_user(self):
        self._create_product()
        self._create_payment()
        self.client.logout()
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_not_own_addon(self):
        self._create_product()
        self._create_payment()
        self.client.force_login(User.objects.get(username='anotheruser'))
        response_get_list = self.client.get(self.url)
        assert response_get_list.status_code == status.HTTP_200_OK
        assert response_get_list.data['results'] == []

    @data('characters', 'seconds')
    def test_get_user_totals(self, usage_type):
        limit = 2000
        usage_limit_key = f'{USAGE_LIMIT_MAP[usage_type]}_limit'
        self._create_product(
            metadata={
                'product_type': 'addon_onetime',
                usage_limit_key: limit,
                'valid_tags': 'all',
            }
        )
        self._create_payment()
        self._create_payment()
        self._create_payment()

        total_limit, remaining = PlanAddOn.get_organization_totals(
            self.organization, usage_type
        )
        assert total_limit == limit * 3
        assert remaining == limit * 3

        PlanAddOn.deduct_add_ons_for_organization(
            self.organization, usage_type, limit
        )
        total_limit, remaining = PlanAddOn.get_organization_totals(
            self.organization, usage_type
        )
        assert total_limit == limit * 3
        assert remaining == limit * 2

    @data(True, False)
    def test_get_multiple_organization_totals(self, get_org_subset):
        limit = 2000
        usage_limit_key = f'mt_characters_limit'
        self._create_product(
            metadata={
                'product_type': 'addon_onetime',
                usage_limit_key: limit,
                'valid_tags': 'all',
            }
        )
        self._create_payment()
        another_user = User.objects.get(username='anotheruser')
        second_customer = self._create_customer_with_subscription(user=another_user)
        self._create_payment(customer=second_customer)
        third_user = User.objects.get(username='adminuser')
        third_customer = self._create_customer_with_subscription(user=third_user)
        self._create_payment(customer=third_customer)

        # either pass just the first two orgs, or nothing to get all orgs
        orgs = (
            [self.organization, second_customer.subscriber] if get_org_subset else None
        )
        results = PlanAddOn.get_all_organization_totals(orgs)

        # if we didn't pass a specified list of orgs, get data for all orgs
        expected_orgs = (
            orgs
            if orgs is not None
            else [
                self.organization,
                second_customer.subscriber,
                third_customer.subscriber,
            ]
        )

        expected_results = {
            org.id: {
                'characters': {
                    'total_usage_limit': 2000,
                    'total_remaining': 2000,
                },
                'seconds': {
                    'total_usage_limit': 0,
                    'total_remaining': 0,
                },
                'submission': {
                    'total_usage_limit': 0,
                    'total_remaining': 0,
                },
            }
            for org in expected_orgs
        }
        assert results == expected_results
