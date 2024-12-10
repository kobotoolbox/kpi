from math import inf

from ddt import data, ddt
from django.test import override_settings
from django.utils import timezone
from djstripe.models import Charge, PaymentIntent, Price, Product
from model_bakery import baker

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.constants import USAGE_LIMIT_MAP
from kobo.apps.stripe.tests.utils import generate_plan_subscription
from kobo.apps.trackers.utils import (
    get_organization_remaining_usage,
    update_nlp_counter,
)
from kpi.models.asset import Asset
from kpi.tests.kpi_test_case import BaseTestCase


@ddt
class TrackersUtilitiesTestCase(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.organization = baker.make(
            Organization, id='123456abcdef', name='test organization'
        )
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.organization.add_user(self.someuser, is_admin=True)

        self.asset = Asset.objects.create(
            content={'survey': [{'type': 'text', 'label': 'q1', 'name': 'q1'}]},
            owner=self.someuser,
            asset_type='survey',
            name='test asset',
        )
        self.asset.deploy(backend='mock', active=True)

    def _create_product(self, product_metadata):
        product = baker.make(
            Product,
            active=True,
            metadata=product_metadata,
        )
        price = baker.make(Price, active=True, product=product, type='one_time')
        product.save()
        return product, price

    def _make_payment(
        self,
        price,
        customer,
        payment_status='succeeded',
        quantity=1,
    ):
        payment_total = quantity * 2000
        payment_intent = baker.make(
            PaymentIntent,
            customer=customer,
            status=payment_status,
            payment_method_types=['card'],
            livemode=False,
            amount=payment_total,
            amount_capturable=payment_total,
            amount_received=payment_total,
        )
        charge = baker.prepare(
            Charge,
            customer=customer,
            refunded=False,
            created=timezone.now(),
            payment_intent=payment_intent,
            paid=True,
            status=payment_status,
            livemode=False,
            amount_refunded=0,
            amount=payment_total,
        )
        charge.metadata = {
            'price_id': price.id,
            'organization_id': self.organization.id,
            'quantity': quantity,
            **(price.product.metadata or {}),
        }
        charge.save()
        return charge

    @data('characters', 'seconds')
    def test_organization_usage_utils(self, usage_type):
        usage_key = f'{USAGE_LIMIT_MAP[usage_type]}_limit'
        sub_metadata = {
            usage_key: '1000',
            'product_type': 'plan',
            'plan_type': 'enterprise',
        }
        subscription = generate_plan_subscription(
            self.organization, metadata=sub_metadata
        )
        addon_metadata = {
            'product_type': 'addon_onetime',
            usage_key: '2000',
            'valid_tags': 'all',
        }
        product, price = self._create_product(addon_metadata)
        self._make_payment(price, subscription.customer, quantity=2)

        total_limit = 2000 * 2 + 1000
        remaining = get_organization_remaining_usage(self.organization, usage_type)
        assert remaining == total_limit

        update_nlp_counter(
            USAGE_LIMIT_MAP[usage_type], 1000, self.someuser.id, self.asset.id
        )

        remaining = get_organization_remaining_usage(self.organization, usage_type)
        assert remaining == total_limit - 1000

        update_nlp_counter(
            USAGE_LIMIT_MAP[usage_type], 1500, self.someuser.id, self.asset.id
        )
        remaining = get_organization_remaining_usage(self.organization, usage_type)
        assert remaining == total_limit - 2500

    @override_settings(
        STRIPE_ENABLED=False,
    )
    @data('characters', 'seconds')
    def test_org_usage_utils_without_stripe(self, usage_type):
        remaining = get_organization_remaining_usage(self.organization, usage_type)
        assert remaining == inf

        update_nlp_counter(
            USAGE_LIMIT_MAP[usage_type], 10000, self.someuser.id, self.asset.id
        )

        remaining = get_organization_remaining_usage(self.organization, usage_type)
        assert remaining == inf
