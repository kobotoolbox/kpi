import pytest
from django.contrib.auth.models import User
from django.urls import reverse

from rest_framework import status
from urllib.parse import urlencode

from kobo.apps.stripe.tests.utils import set_up_stripe
from kpi.tests.kpi_test_case import BaseTestCase


class TestCheckoutLinkAPITestCase(BaseTestCase):
    fixtures = ['test_data']

    def setUpClass(self):
        self.someuser = set_up_stripe()
        self.client.force_login(self.someuser)

    @staticmethod
    def _get_url(query_params):
        url = reverse('changeplan')
        return f'{url}?{urlencode(query_params)}'

    def _modify_price(self, subscription, price):
        url = self._get_url({'price_id': price.id, 'subscription_id': subscription.id})
        return self.client.post(url)

    def _create_subscription(self):
        pass

    @pytest.mark.stripe
    def test_upgrades_subscription(self):
        response = None
        assert response.status_code == status.HTTP_200_OK
        assert response.status == 'succeeded'

    @pytest.mark.stripe
    def test_downgrades_subscription(self):
        response = None
        assert response.status_code == status.HTTP_200_OK
        assert response.status == 'scheduled'

    @pytest.mark.stripe
    def test_rejects_invalid_query_params(self):
        url = self._get_url({'price_id': 'test', 'subscription_id': 'test'})
        response = self.client.post(url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.stripe
    def test_doesnt_modify_subscription_if_not_owner(self):
        anotheruser = User.objects.get(username='anotheruser')
        self.client.force_login(anotheruser)
        response = None
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.stripe
    def test_anonymous_user(self):
        self.client.logout()
        response = None
        assert response.status_code == status.HTTP_403_FORBIDDEN
