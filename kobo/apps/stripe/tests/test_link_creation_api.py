import stripe

from django.contrib.auth.models import User
from django.urls import reverse

from djstripe.models import Customer, Price, Subscription
from model_bakery import baker
from rest_framework import status
from unittest.mock import patch

from kobo.apps.organizations.models import Organization
from kpi.tests.kpi_test_case import BaseTestCase


class TestCheckoutLinkAPITestCase(BaseTestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.client.force_login(self.someuser)

    def _insert_data(self):
        organization = baker.make(Organization)
        organization.add_user(self.someuser, is_admin=True)
        self.customer = baker.make(Customer, subscriber=organization)
        price = baker.make(Price, active=True, product__active=True)
        self.subscription = baker.make(
            Subscription,
            customer=self.customer,
            items=[{'price': price}],
            livemode=False,
        )
        self.url = reverse(
            'checkoutlinks',
            kwargs={
                'organization_uid': organization.uid,
                'price_id': price.id
            }
        )

    @patch("stripe.Customer.modify")
    @patch("djstripe.models.Customer.get_or_create")
    @patch("stripe.checkout.Session.create")
    def test_creates_organization(
        self, stripe_customer_modify_mock, customer_get_or_create_mock, stripe_checkout_create_mock,
    ):
        self._insert_data()
        stripe_customer_modify_mock.return_value = None
        customer_get_or_create_mock.return_value = Customer
        stripe_checkout_create_mock.return_value = {'url': 'https://https://checkout.stripe.com/c/pay/cs_test_a1NbsdWp'}
        response = self.client.post(self.url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['url'].startswith('https://checkout.stripe.com')

    def test_get_endpoint(self):
        self._insert_data()
        response_get_list = self.client.get(self.url_list)
        assert response_get_list.status_code == status.HTTP_200_OK
        response_get_detail = self.client.get(self.url_detail)
        assert response_get_detail.status_code == status.HTTP_200_OK

    def test_anonymous_user(self):
        self.client.logout()
        response = self.client.post(reverse('checkoutlinks'))
        assert response.status_code == status.HTTP_403_FORBIDDEN
