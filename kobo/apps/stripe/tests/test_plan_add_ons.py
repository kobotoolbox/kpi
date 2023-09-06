from django.contrib.auth.models import User
from django.utils import timezone
from djstripe.models import Customer, Product, Price, PaymentIntent, Charge
from model_bakery import baker

from kobo.apps.organizations.models import Organization
from kobo.apps.stripe.models import PlanAddOn
from kpi.tests.kpi_test_case import BaseTestCase


class TestPlanAddOnTestCase(BaseTestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.some_user = User.objects.get(username='someuser')
        self.client.force_login(self.some_user)
        self.organization = baker.make(Organization, id='orgSALFMLFMSDGmgdlsgmsd')
        self.customer = baker.make(Customer, subscriber=self.organization)

    def _create_product(self, metadata):
        self.product = baker.make(
            Product,
            active=True,
            metadata=metadata,
        )
        self.price = baker.make(Price, active=True, product=self.product, type='one_time')
        self.product.save()

    def _create_payment(self, status='succeeded', refunded=False):
        self.payment_intent = baker.make(
            PaymentIntent,
            customer=self.customer,
            status=status,
            payment_method_types=["card"],
            livemode=False,
            amount=2000,
            amount_capturable=2000,
            amount_received=2000,
        )
        self.charge = baker.prepare(
            Charge,
            customer=self.customer,
            refunded=refunded,
            created=timezone.now(),
            payment_intent=self.payment_intent,
            paid=True,
            status='succeeded',
            livemode=False,
            amount_refunded=0 if refunded else 2000,
            amount=2000,
            metadata={
                'price_id': self.price.id,
                'organization_id': self.organization.id,
                **self.product.metadata,
            }
        )
        self.charge.save()

    def test_add_on_is_created_on_charge(self):
        self._create_product({'product_type': 'addon', 'mt_characters_limit': 2000})
        self._create_payment()
        add_on = PlanAddOn.objects.get(charge=self.charge)
        assert add_on.product == self.product
        assert len(add_on.usage_limits.keys()) == 1
        assert add_on.usage_limits['mt_characters_limit'] == 2000
        assert add_on.is_available is True

    def test_add_on_inactive_on_refunded_charge(self):
        self._create_product({'product_type': 'addon', 'asr_seconds_limit': 2000})
        self._create_payment(refunded=True)
        add_on = PlanAddOn.objects.get(charge=self.charge)
        assert add_on.is_available is False

    def test_add_on_inactive_on_cancelled_charge(self):
        self._create_product({'product_type': 'addon', 'submissions_limit': 2000})
        self._create_payment(status='cancelled')
        add_on = PlanAddOn.objects.get(charge=self.charge)
        assert add_on.is_available is False
