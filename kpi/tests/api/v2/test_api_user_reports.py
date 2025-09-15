from unittest.mock import patch

import pytest
from django.conf import settings
from django.db import connection
from django.urls import reverse
from djstripe.enums import BillingScheme
from djstripe.models import Customer
from model_bakery import baker
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.constants import UsageType
from kpi.models.user_reports import BillingAndUsageSnapshot
from kpi.tests.base_test_case import BaseTestCase


@pytest.mark.skipif(not settings.STRIPE_ENABLED, reason='Requires stripe functionality')
class UserReportsViewSetAPITestCase(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='adminuser', password='pass')
        self.url = reverse(self._get_endpoint('api_v2:user-reports-list'))

        # Create and add a subscription to someuser
        self.someuser = User.objects.get(username='someuser')
        organization = self.someuser.organization
        self.customer = baker.make(Customer, subscriber=organization)
        self.subscription = baker.make(
            'djstripe.Subscription',
            customer=self.customer,
            items__price__livemode=False,
            items__price__billing_scheme=BillingScheme.per_unit,
            livemode=False,
            metadata={'organization_id': str(organization.id)},
        )

        baker.make('kpi.BillingAndUsageSnapshot', organization_id=organization.id)

        # Manually refresh the materialized view
        with connection.cursor() as cursor:
            cursor.execute('REFRESH MATERIALIZED VIEW user_reports_mv;')

    def test_list_view_requires_authentication(self):
        self.client.logout()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_view_requires_superuser_permission(self):
        self.client.logout()
        self.client.force_login(user=self.someuser)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_view_succeeds_for_superuser(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Make sure that all 3 users from the 'test_data' are included
        self.assertEqual(len(response.data['results']), 3)

    def test_endpoint_returns_error_when_stripe_is_disabled(self):
        try:
            settings.STRIPE_ENABLED = False
            response = self.client.get(self.url)

            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
            self.assertEqual(
                response.json(),
                {'details': 'Stripe must be enabled to access this endpoint.'},
            )
        finally:
            # Restore the original setting
            settings.STRIPE_ENABLED = True

    def test_endpoint_returns_error_when_mv_is_missing(self):
        # Drop the materialized view before the test
        with connection.cursor() as cursor:
            cursor.execute('DROP MATERIALIZED VIEW IF EXISTS user_reports_mv CASCADE;')

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(
            response.json(),
            {
                'details': 'The data source for user reports is missing. '
                'Please run migration 0070 to create the materialized '
                'view: user_reports_mv.',
            },
        )

    def test_subscription_data_is_correctly_returned(self):
        user_with_sub = self._get_someuser_data()
        self.assertEqual(len(user_with_sub['subscriptions']), 1)
        self.assertEqual(user_with_sub['subscriptions'][0]['id'], self.subscription.id)

        subscription_item = user_with_sub['subscriptions'][0]['items'][0]

        self.assertEqual(subscription_item['id'], self.subscription.items.first().id)
        self.assertEqual(
            subscription_item['price']['id'], self.subscription.items.first().price.id
        )
        self.assertEqual(
            subscription_item['price']['product']['id'],
            self.subscription.items.first().price.product.id,
        )
        self.assertEqual(
            user_with_sub['subscriptions'][0]['customer'], self.customer.id
        )
        self.assertEqual(
            user_with_sub['subscriptions'][0]['metadata']['organization_id'],
            self.subscription.metadata['organization_id'],
        )

    @patch('kpi.serializers.v2.user_reports.get_organizations_effective_limits')
    def test_current_service_usage_data_is_correctly_returned(self, mock_get_limits):
        # Update a BillingAndUsageSnapshot with specific usage data
        billing_and_usage_snapshot = BillingAndUsageSnapshot.objects.get(
            organization_id=self.someuser.organization.id
        )
        billing_and_usage_snapshot.current_period_submissions = 15
        billing_and_usage_snapshot.submission_counts_all_time = 150
        billing_and_usage_snapshot.current_period_asr = 120
        billing_and_usage_snapshot.nlp_usage_asr_seconds_total = 240
        billing_and_usage_snapshot.storage_bytes_total = 200000000
        billing_and_usage_snapshot.save()

        # Mock `get_organizations_effective_limits` to return test limits.
        mock_limits = {
            self.someuser.organization.id: {
                f'{UsageType.SUBMISSION}_limit': 10,  # Exceeded
                f'{UsageType.STORAGE_BYTES}_limit': 500000000,  # Not exceeded
                f'{UsageType.ASR_SECONDS}_limit': 120,  # At the limit
                f'{UsageType.MT_CHARACTERS}_limit': 5,  # Not used
            }
        }
        mock_get_limits.return_value = mock_limits

        # Refresh the materialized view to sync with the snapshot
        with connection.cursor() as cursor:
            cursor.execute('REFRESH MATERIALIZED VIEW user_reports_mv;')

        someuser_data = self._get_someuser_data()

        service_usage = someuser_data['current_service_usage']
        # Assert total usage counts from the snapshot
        self.assertEqual(service_usage['total_submission_count']['current_period'], 15)
        self.assertEqual(service_usage['total_submission_count']['all_time'], 150)
        self.assertEqual(service_usage['total_storage_bytes'], 200000000)
        self.assertEqual(
            service_usage['total_nlp_usage']['asr_seconds_current_period'], 0
        )
        self.assertEqual(service_usage['total_nlp_usage']['asr_seconds_all_time'], 0)
        self.assertEqual(
            service_usage['total_nlp_usage']['mt_characters_current_period'], 0
        )
        self.assertEqual(service_usage['total_nlp_usage']['mt_characters_all_time'], 0)

        # Assert calculated balances based on mock limits and real results
        balances = service_usage['balances']

        # Submission balance: 15 / 10 = 1.5, so 150% and exceeded.
        self.assertIsNotNone(balances['submission'])
        self.assertTrue(balances['submission']['exceeded'])
        self.assertEqual(balances['submission']['effective_limit'], 10)
        self.assertEqual(balances['submission']['balance_value'], -5)
        self.assertEqual(balances['submission']['balance_percent'], 150)

        # Storage balance: 200,000,000 / 500,000,000 = 0.4, so 40% and not exceeded.
        self.assertIsNotNone(balances['storage_bytes'])
        self.assertFalse(balances['storage_bytes']['exceeded'])
        self.assertEqual(balances['storage_bytes']['effective_limit'], 500000000)
        self.assertEqual(balances['storage_bytes']['balance_value'], 300000000)
        self.assertEqual(balances['storage_bytes']['balance_percent'], 40)

        # ASR Seconds balance: 0 / 120 = 0, so 0% and not exceeded.
        self.assertIsNotNone(balances['asr_seconds'])
        self.assertFalse(balances['asr_seconds']['exceeded'])
        self.assertEqual(balances['asr_seconds']['effective_limit'], 120)
        self.assertEqual(balances['asr_seconds']['balance_value'], 120)
        self.assertEqual(balances['asr_seconds']['balance_percent'], 0)

        # MT Characters balance: 0 / 5 = 0, so 0% and not exceeded.
        self.assertIsNotNone(balances['mt_characters'])
        self.assertFalse(balances['mt_characters']['exceeded'])
        self.assertEqual(balances['mt_characters']['effective_limit'], 5)
        self.assertEqual(balances['mt_characters']['balance_value'], 5)
        self.assertEqual(balances['mt_characters']['balance_percent'], 0)

    def test_organization_data_is_correctly_returned(self):
        someuser_data = self._get_someuser_data()

        organization_data = someuser_data['organizations']

        self.assertEqual(
            organization_data['organization_name'], self.someuser.organization.name
        )
        self.assertEqual(
            organization_data['organization_uid'], str(self.someuser.organization.id)
        )
        self.assertEqual(organization_data['role'], 'owner')

    def test_account_restricted_field(self):
        # Verify `account_restricted` is initially false
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data['results']
        someuser_data = next(
            (user for user in results if user['username'] == 'someuser'),
            None,
        )

        self.assertIsNotNone(someuser_data)
        self.assertFalse(someuser_data['account_restricted'])

        # Update the BillingAndUsageSnapshot to exceed the desired limit
        billing_and_usage_snapshot = BillingAndUsageSnapshot.objects.get(
            organization_id=self.someuser.organization.id
        )
        billing_and_usage_snapshot.current_period_submissions = 10
        billing_and_usage_snapshot.save()

        # Mock the `get_organizations_effective_limits` function
        # to return a predefined limit
        mock_limits = {
            self.someuser.organization.id: {f'{UsageType.SUBMISSION}_limit': 1}
        }
        with patch(
            'kpi.serializers.v2.user_reports.get_organizations_effective_limits',
            return_value=mock_limits,
        ):
            with connection.cursor() as cursor:
                cursor.execute('REFRESH MATERIALIZED VIEW user_reports_mv;')

            someuser_data = self._get_someuser_data()
            self.assertTrue(someuser_data['account_restricted'])

    def test_accepted_tos_field(self):
        # Verify `accepted_tos` is initially false
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data['results']
        self.assertEqual(results[0]['accepted_tos'], False)

        # POST to the tos endpoint to accept the terms of service
        tos_url = reverse(self._get_endpoint('tos'))
        response = self.client.post(tos_url)
        assert response.status_code == status.HTTP_204_NO_CONTENT

        with connection.cursor() as cursor:
            cursor.execute('REFRESH MATERIALIZED VIEW user_reports_mv;')

        # Verify `accepted_tos` has been set to True
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data['results']
        self.assertTrue(results[0]['accepted_tos'])

    def test_filter_by_email_icontains(self):
        response = self.client.get(self.url, {'email': 'some@user'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['email'], 'some@user.com')

    def test_filter_by_username_icontains(self):
        response = self.client.get(self.url, {'username': 'some'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['username'], 'someuser')

    def test_filter_by_submission_counts_range(self):
        billing_and_usage_snapshot = BillingAndUsageSnapshot.objects.get(
            organization_id=self.someuser.organization.id
        )
        billing_and_usage_snapshot.submission_counts_all_time = 50
        billing_and_usage_snapshot.save()

        with connection.cursor() as cursor:
            cursor.execute('REFRESH MATERIALIZED VIEW user_reports_mv;')

        # Test filter for submissions > 40
        response = self.client.get(self.url, {'submission_counts_all_time_min': 40})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['username'], 'someuser')

        # Test filter for submissions < 40
        response = self.client.get(self.url, {'submission_counts_all_time_max': 40})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(response.data['count'], 0)

    def test_ordering_by_date_joined(self):
        response = self.client.get(self.url, {'ordering': 'date_joined'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data['results']
        self.assertEqual(results[0]['username'], 'adminuser')
        self.assertEqual(results[1]['username'], 'someuser')
        self.assertEqual(results[2]['username'], 'anotheruser')

    def _get_someuser_data(self):

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data['results']
        someuser_data = next(
            (user for user in results if user['username'] == 'someuser'), None
        )
        self.assertIsNotNone(someuser_data)
        return someuser_data
