from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from djstripe.models import Customer, PaymentIntent, Charge, Price, Product
from model_bakery import baker
from rest_framework import status

from kobo.apps.organizations.models import Organization
from kpi.tests.kpi_test_case import BaseTestCase


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

    def _create_product(self, metadata=None):
        if not metadata:
            metadata = {'product_type': 'addon', 'submissions_limit': 2000}
        self.product = baker.make(
            Product,
            active=True,
            metadata=metadata,
        )
        self.price = baker.make(Price, active=True, product=self.product, type='one_time')
        self.product.save()

    def _create_payment(self, status='succeeded', refunded=False, quantity=1):
        payment_total = quantity * 2000
        self.payment_intent = baker.make(
            PaymentIntent,
            customer=self.customer,
            status=status,
            payment_method_types=["card"],
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
            payment_intent=self.payment_intent,
            paid=True,
            status=status,
            livemode=False,
            amount_refunded=0 if refunded else payment_total,
            amount=payment_total,
        )
        self.charge.metadata = {
            'price_id': self.price.id,
            'organization_id': self.organization.id,
            'quantity': quantity,
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
        self._create_product(metadata={'product_type': 'subscription', 'submissions_limit': 2000})
        self._create_payment()
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 0

        self._create_product(metadata={'product_type': 'addon', 'not_a_real_limit_key': 2000})
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

    def test_addon_inactive_for_cancelled_charge(self):
        self._create_product()
        self._create_payment(status='cancelled')
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert not response.data['results'][0]['is_available']

    def test_anonymous_user(self):
        self._create_product()
        self._create_payment()
        self.client.logout()
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_not_own_addon(self):
        self._create_product()
        self._create_payment()
        self.client.force_login(User.objects.get(username='anotheruser'))
        response_get_list = self.client.get(self.url)
        assert response_get_list.status_code == status.HTTP_200_OK
        assert response_get_list.data['results'] == []
