import stripe

from django.contrib.auth.models import User
from django.urls import reverse

from djstripe.models import Customer, Price, Product, Subscription, SubscriptionItem, SubscriptionSchedule
from model_bakery import baker
from rest_framework import status
from urllib.parse import urlencode
from unittest.mock import patch

from kobo.apps.organizations.models import Organization
from kpi.tests.kpi_test_case import BaseTestCase


class TestCheckoutLinkAPITestCase(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.client.force_login(self.someuser)
        product = baker.prepare(Product, active=True)
        product.save()
        self.low_price = baker.make(
            Price,
            active=True,
            id='price_1LsSOSAR39rDI89svTKog9Hq',
            product=product,
            unit_amount=1000,
        )
        self.high_price = baker.make(
            Price,
            active=True,
            id='price_sfmOFe33rfsfd36685657',
            product=product,
            unit_amount=2000,
        )

    @staticmethod
    def _get_url(query_params):
        url = reverse('changeplan')
        return f'{url}?{urlencode(query_params)}'

    def _create_customer_organization(self):
        organization = baker.make(
            Organization, id='orgSALFMLFMSDGmgdlsgmsd'
        )
        customer = baker.make(Customer, subscriber=organization)
        return customer, organization

    def _subscribe_organization(self, organization, customer, price):
        subscription_item = baker.make(SubscriptionItem, price=price, quantity=1, livemode=False)
        return baker.make(Subscription, customer=customer, status='active', items=[subscription_item], livemode=False)

    @patch("stripe.Subscription.modify")
    @patch("stripe.SubscriptionSchedule.create")
    @patch("stripe.SubscriptionSchedule.modify")
    def _modify_price(self, price_from, price_to, schedule_modify, subscription_schedule_create, subscription_modify):
        customer, organization = self._create_customer_organization()
        organization.add_user(self.someuser, is_admin=True)
        subscription = self._subscribe_organization(organization, customer, price_from)
        url = self._get_url(
            {'price_id': price_to.id, 'subscription_id': subscription.id}
        )
        subscription_schedule = baker.make(SubscriptionSchedule, customer=customer, phases=[
            {
                'iterations': 1,
                'items': [
                    {
                        'price': price_from.id,
                        'quantity': 1,
                    }
                ],
            }
        ])
        subscription_schedule_create.return_value = subscription_schedule
        return self.client.post(url)

    def test_upgrades_subscription(self):
        response = self._modify_price(self.low_price, self.high_price)
        assert response.status_code == status.HTTP_200_OK

    def test_downgrades_subscription(self):
        response = self._modify_price(self.high_price, self.low_price)
        assert response.status_code == status.HTTP_200_OK

    def test_rejects_invalid_query_params(self):
        url = self._get_url({'price_id': 'test', 'subscription_id': 'test'})
        response = self.client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_doesnt_modify_subscription_if_not_owner(self):
        anotheruser = User.objects.get(username='anotheruser')
        self.client.force_login(anotheruser)
        response = self._modify_price(self.high_price, self.low_price)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_anonymous_user(self):
        self.client.logout()
        response = self._modify_price(self.high_price, self.low_price)
        assert response.status_code == status.HTTP_403_FORBIDDEN
