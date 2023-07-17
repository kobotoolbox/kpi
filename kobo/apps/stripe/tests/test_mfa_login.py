# coding: utf-8
from django.contrib.auth.models import User
from django.urls import reverse
from djstripe.models import Customer, Price, SubscriptionItem, Subscription
from model_bakery import baker
from rest_framework import status
from trench.utils import get_mfa_model

from kobo.apps.organizations.models import Organization, OrganizationUser
from kpi.tests.kpi_test_case import KpiTestCase


class TestStripeMFALogin(KpiTestCase):
    def setUp(self):
        self.someuser = User.objects.get(username='someuser')

        # Activate MFA for someuser
        get_mfa_model().objects.create(
            user=self.someuser,
            secret='dummy_mfa_secret',
            name='app',
            is_primary=True,
            is_active=True,
            _backup_codes='dummy_encoded_codes',
        )
        # Ensure `self.client` is not authenticated
        self.client.logout()

        self.organization = baker.make(
            Organization, id='orgSALFMLFMSDGmgdlsgmsd'
        )
        self.organization_user = baker.make(
            OrganizationUser,
            user=self.someuser,
            organization=self.organization,
        )

    def _create_subscription(self, unit_amount=0, billing_status='active'):
        self.customer = baker.make(Customer, subscriber=self.organization)
        self.price = baker.make(Price, unit_amount=unit_amount)
        self.subscription_item = baker.make(SubscriptionItem, price=self.price)
        self.subscription = baker.make(
            Subscription,
            customer=self.customer,
            items=[self.subscription_item],
            status=billing_status,
        )

    def test_no_mfa_login_without_subscription(self):
        """
        Validate that multi-factor authentication form is not displayed after
        successful login if the user doesn't have a paid subscription
        """

        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(reverse('kobo_login'), data=data)
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)

    def test_mfa_login_works_with_paid_subscription(self):
        """
        Validate that multi-factor authentication form is displayed after
        successful login if the user has a paid subscription
        """

        self._create_subscription(unit_amount=2000)

        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(reverse('kobo_login'), data=data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, "verification token")

    def test_no_mfa_login_with_free_subscription(self):
        """
        Validate that multi-factor authentication form is not displayed after
        successful login if the user has a free subscription
        """

        self._create_subscription()

        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(reverse('kobo_login'), data=data)
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)

    def test_no_mfa_login_with_canceled_subscription(self):
        """
        Validate that multi-factor authentication form is not displayed after
        successful login if the user only has a cancelled subscription
        """

        self._create_subscription(billing_status='canceled')

        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(reverse('kobo_login'), data=data)
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
