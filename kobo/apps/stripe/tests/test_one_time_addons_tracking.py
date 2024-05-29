from dateutil.relativedelta import relativedelta
from django.contrib.auth.models import User
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from djstripe.models import (
    Charge,
    Customer,
    PaymentIntent,
    Price,
    Product,
    Subscription,
    SubscriptionItem,
)
from model_bakery import baker

from kobo.apps.organizations.models import Organization, OrganizationUser
from kobo.apps.trackers.models import NLPUsageCounter
from kobo.apps.trackers.submission_utils import (
    create_mock_assets,
)
from kobo.apps.stripe.models import PlanAddOn
from kobo.apps.trackers.utils import update_nlp_counter
from kpi.tests.api.v2.test_api_service_usage import ServiceUsageAPIBase


class OneTimeAddonTrackingTestCase(ServiceUsageAPIBase):
    """
    Test OT addon tracking when Stripe is enabled.
    """

    org_id = 'orgAKWMFskafsngf'
    subscription_limit = 1000
    addon_limit = 2000

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.now = timezone.now()

        anotheruser = User.objects.get(username='anotheruser')
        cls.organization = baker.make(
            Organization, id=cls.org_id, name='test organization'
        )
        cls.organization.add_user(cls.anotheruser, is_admin=True)
        assets = create_mock_assets([cls.anotheruser], 1)
        cls.asset = assets[0]

        cls.customer = baker.make(
            Customer, subscriber=cls.organization, livemode=False
        )
        cls.organization.save()

    def setUp(self):
        super().setUp()
        url = reverse(self._get_endpoint('organizations-list'))
        self.detail_url = f'{url}{self.org_id}/service_usage/'
        self._generate_subscription()
        self._create_payment()

    def tearDown(self):
        cache.clear()

    def _generate_subscription(
        self,
    ):
        product = baker.make(
            Product,
            active=True,
            metadata={
                'product_type': 'plan',
                'plan_type': 'enterprise',
                'organizations': True,
                'nlp_seconds_limit': self.subscription_limit,
            },
        )
        price = baker.make(
            Price,
            active=True,
            id='price_sfmOFe33rfsfd36685657',
            recurring={'interval': 'month'},
            product=product,
        )

        subscription = baker.make(
            Subscription,
            customer=self.customer,
            status='active',
            livemode=False,
            billing_cycle_anchor=self.now - relativedelta(weeks=2),
            current_period_end=self.now + relativedelta(weeks=2),
            current_period_start=self.now - relativedelta(weeks=2),
        )
        baker.make(
            SubscriptionItem,
            subscription=subscription,
            price=price,
            quantity=1,
            livemode=False,
        )

    def _create_payment(
        self, payment_status='succeeded', refunded=False, quantity=1
    ):
        metadata = {
            'product_type': 'addon_onetime',
            'asr_seconds_limit': self.addon_limit,
            'valid_tags': 'all',
        }
        product = baker.make(
            Product,
            active=True,
            metadata=metadata,
        )
        price = baker.make(Price, active=True, product=product, type='one_time')
        product.save()
        payment_total = quantity * 2000
        payment_intent = baker.make(
            PaymentIntent,
            customer=self.customer,
            status=payment_status,
            payment_method_types=['card'],
            livemode=False,
            amount=payment_total,
            amount_capturable=payment_total,
            amount_received=payment_total,
        )
        self.charge = baker.prepare(
            Charge,
            customer=self.customer,
            refunded=refunded,
            created=timezone.now(),
            payment_intent=payment_intent,
            paid=True,
            status=payment_status,
            livemode=False,
            amount_refunded=0 if refunded else payment_total,
            amount=payment_total,
        )
        self.charge.metadata = {
            'price_id': price.id,
            'organization_id': self.organization.id,
            'quantity': quantity,
            **(product.metadata),
        }
        self.charge.save()

    def test_increment_addon_usage(self):
        # update_nlp_counter will error out if cache isn't updated first
        # Also note that the used asr_seconds_current_month has to be > subscription limit,
        # otherwise the addon will not be incremented (and neither will the counter, therefore)
        self.organization.update_usage_cache(
            {
                'total_nlp_usage': {
                    'asr_seconds_current_month': self.subscription_limit,
                    'mt_characters_current_month': 0,
                }
            }
        )

        seconds_used = 1000

        update_nlp_counter(
            'mock_asr_seconds', seconds_used, self.anotheruser.id, self.asset.id
        )

        counter = NLPUsageCounter.objects.first()
        addon = PlanAddOn.objects.first()

        assert counter.counters['addon_used_asr_seconds'] == seconds_used
        assert (
            addon.limits_remaining['asr_seconds_limit']
            == self.addon_limit - seconds_used
        )

        more_seconds_used = 500

        update_nlp_counter(
            'mock_asr_seconds', more_seconds_used, self.anotheruser.id, self.asset.id
        )

        counter = NLPUsageCounter.objects.first()
        addon = PlanAddOn.objects.first()

        assert counter.counters['addon_used_asr_seconds'] == seconds_used + more_seconds_used
        assert (
            addon.limits_remaining['asr_seconds_limit']
            == self.addon_limit - (seconds_used + more_seconds_used)
        )

    def test_increment_addon_usage_over_limit(self):
        self.organization.update_usage_cache(
            {
                'total_nlp_usage': {
                    'asr_seconds_current_month': self.subscription_limit,
                    'mt_characters_current_month': 0,
                }
            }
        )

        seconds_used = 3000

        update_nlp_counter(
            'mock_asr_seconds', seconds_used, self.anotheruser.id, self.asset.id
        )

        counter = NLPUsageCounter.objects.first()
        addon = PlanAddOn.objects.first()

        assert counter.counters['addon_used_asr_seconds'] == self.addon_limit
        assert addon.limits_remaining['asr_seconds_limit'] == 0
