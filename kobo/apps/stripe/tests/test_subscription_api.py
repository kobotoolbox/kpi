from django.contrib.auth.models import User
from django.urls import reverse
from djstripe.models import Customer, Plan, Subscription
from model_bakery import baker
from rest_framework import status

from kobo.apps.organizations.models import Organization
from kpi.tests.kpi_test_case import BaseTestCase


class SubscriptionAPITestCase(BaseTestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.client.force_login(self.someuser)
        self.url_list = reverse('subscriptions-list')

    def _insert_data(self):
        organization = baker.make(Organization)
        organization.add_user(self.someuser, is_admin=True)
        customer = baker.make(Customer, subscriber=organization)
        plan = baker.make(Plan)
        self.subscription = baker.make(
            Subscription,
            customer=customer,
            plan=plan,
            livemode=False,
        )
        self.url_detail = reverse(
            'subscriptions-detail',
            kwargs={
                'id': self.subscription.id
            }
        )

    def test_no_subscriptions(self):
        response = self.client.get(self.url_list)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['results'] == []

    def test_get_endpoint(self):
        self._insert_data()
        response_get_list = self.client.get(self.url_list)
        assert response_get_list.status_code == status.HTTP_200_OK
        response_get_detail = self.client.get(self.url_detail)
        assert response_get_detail.status_code == status.HTTP_200_OK

    def test_anonymous_user(self):
        self.client.logout()
        response = self.client.get(reverse('subscriptions-list'))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_not_own_subscription(self):
        self._insert_data()
        self.client.force_login(User.objects.get(username='anotheruser'))
        response_get_list = self.client.get(self.url_list)
        assert response_get_list.status_code == status.HTTP_200_OK
        assert response_get_list.data['results'] == []
        response_get_detail = self.client.get(self.url_detail)
        assert response_get_detail.status_code == status.HTTP_404_NOT_FOUND
