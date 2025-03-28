from ddt import data, ddt
from django.urls import reverse
from djstripe.models import Customer, Subscription
from model_bakery import baker
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.constants import USAGE_LIMIT_MAP
from kobo.apps.stripe.models import PlanAddOn
from kobo.apps.stripe.tests.utils import _create_one_time_addon_product, _create_payment
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

    def _create_product(self, metadata=None):
        if not metadata:
            metadata = {
                'product_type': 'addon_onetime',
                'submission_limit': 2000,
                'valid_tags': 'all',
            }
        product = _create_one_time_addon_product(limit_metadata=metadata)
        self.product = product
        self.price = product.default_price

    def _create_payment(self, payment_status='succeeded', refunded=False):
        charge = _create_payment(
            customer=self.customer,
            price=self.price,
            product=self.product,
            payment_status=payment_status,
            refunded=refunded
        )
        self.charge = charge

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

    def test_get_organizations_totals(self):
        addon = _create_one_time_addon_product(
            limit_metadata={
                'mt_characters_limit': 2000,
                'valid_tags': 'all',
                'asr_seconds_limit': 3000,
            }
        )
        anotheruser = User.objects.get(username='anotheruser')
        second_organization = baker.make(Organization)
        second_organization.add_user(anotheruser, is_admin=True)
        second_customer = baker.make(Customer, subscriber=second_organization)
        _create_payment(second_customer, product=addon, price=addon.default_price)
        _create_payment(self.customer, product=addon, price=addon.default_price)
        _create_payment(self.customer, product=addon, price=addon.default_price)
        results = PlanAddOn.get_organizations_totals()
        assert results[self.organization.id]['total_seconds_limit'] == 6000
        assert results[self.organization.id]['total_characters_limit'] == 4000
        assert results[second_organization.id]['total_seconds_limit'] == 3000
        assert results[second_organization.id]['total_characters_limit'] == 2000
