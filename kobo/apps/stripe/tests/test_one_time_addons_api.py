from django.urls import reverse
from djstripe.enums import BillingScheme
from djstripe.models import Customer, PaymentIntent
from model_bakery import baker
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kpi.tests.kpi_test_case import BaseTestCase


class OneTimeAddOnAPITestCase(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.client.force_login(self.someuser)
        self.url = reverse('addons-list')
        self.price_id = 'price_305dfs432ltnjw'

    def _insert_data(self):
        self.organization = baker.make(Organization)
        self.organization.add_user(self.someuser, is_admin=True)
        self.customer = baker.make(Customer, subscriber=self.organization)

    def _create_session_and_payment_intent(self):
        payment_intent = baker.make(
            PaymentIntent,
            customer=self.customer,
            status='succeeded',
            payment_method_types=["card"],
            livemode=False,
        )
        session = baker.make(
            'djstripe.Session',
            customer=self.customer,
            metadata={
                'organization_id': self.organization.id,
                'price_id': self.price_id,
            },
            mode='payment',
            payment_intent=payment_intent,
            payment_method_types=["card"],
            items__price__livemode=False,
            items__price__billing_scheme=BillingScheme.per_unit,
            livemode=False,
        )

    def test_no_addons(self):
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['results'] == []

    def test_get_endpoint(self):
        self._insert_data()
        self._create_session_and_payment_intent()
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1

    def test_anonymous_user(self):
        self._insert_data()
        self._create_session_and_payment_intent()
        self.client.logout()
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_not_own_addon(self):
        self._insert_data()
        self._create_session_and_payment_intent()
        self.client.force_login(User.objects.get(username='anotheruser'))
        response_get_list = self.client.get(self.url)
        assert response_get_list.status_code == status.HTTP_200_OK
        assert response_get_list.data['results'] == []
