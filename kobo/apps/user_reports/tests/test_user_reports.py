from unittest.mock import patch

import pytest
from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.urls import reverse
from django.utils import timezone
from model_bakery import baker
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import DailyXFormSubmissionCounter
from kobo.apps.openrosa.apps.main.models import UserProfile
from kobo.apps.organizations.constants import UsageType
from kobo.apps.trackers.models import NLPUsageCounter
from kobo.apps.user_reports.models import BillingAndUsageSnapshot
from kobo.apps.user_reports.tasks import refresh_user_report_snapshots
from kobo.apps.user_reports.utils.snapshot_refresh_helpers import (
    refresh_user_reports_materialized_view,
)
from kpi.tests.base_test_case import BaseTestCase


class UserReportsViewSetAPITestCase(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='adminuser', password='pass')
        self.url = reverse(self._get_endpoint('api_v2:user-reports-list'))

        self.someuser = User.objects.get(username='someuser')
        self.organization = self.someuser.organization

        baker.make(BillingAndUsageSnapshot, organization_id=self.organization.id)

        refresh_user_reports_materialized_view(concurrently=False)

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

    def test_endpoint_returns_error_when_mv_is_missing(self):
        # Drop the materialized view before the test
        with connection.cursor() as cursor:
            cursor.execute(
                'DROP MATERIALIZED VIEW IF EXISTS user_reports_userreportsmv CASCADE;'
            )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(
            response.json(),
            {
                'details': 'The data source for user reports is missing. '
                'Please run 0002_create_user_reports_mv to create the '
                'materialized view: user_reports_userreportsmv.',
            },
        )

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    def test_subscription_data_is_correctly_returned(self):

        # Create and add a subscription to someuser
        from djstripe.enums import BillingScheme
        from djstripe.models import Customer

        self.customer = baker.make(Customer, subscriber=self.organization)
        self.subscription = baker.make(
            'djstripe.Subscription',
            customer=self.customer,
            items__price__livemode=False,
            items__price__billing_scheme=BillingScheme.per_unit,
            livemode=False,
            metadata={'organization_id': str(self.organization.id)},
        )
        refresh_user_reports_materialized_view(concurrently=False)
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

    def test_service_usage_data_is_correctly_returned(self):
        """
        Test that the service usage data is correctly calculated and returned
        in the user report, including balances based on mocked limits
        """
        # Create submission counter entries to simulate usage
        DailyXFormSubmissionCounter.objects.create(
            user_id=self.someuser.id,
            date=timezone.now().date(),
            counter=15
        )
        DailyXFormSubmissionCounter.objects.create(
            user_id=self.someuser.id,
            date=timezone.now().date() - timezone.timedelta(days=100),
            counter=135
        )
        NLPUsageCounter.objects.create(
            user_id=self.someuser.id,
            date=timezone.now().date(),
            total_asr_seconds=100
        )
        NLPUsageCounter.objects.create(
            user_id=self.someuser.id,
            date=timezone.now().date() - timezone.timedelta(days=100),
            total_asr_seconds=80,
        )
        UserProfile.objects.filter(user_id=self.someuser.id).update(
            attachment_storage_bytes=200000000
        )

        # Mock `get_organizations_effective_limits` to return test limits.
        mock_limits = {
            self.someuser.organization.id: {
                f'{UsageType.SUBMISSION}_limit': 10,
                f'{UsageType.STORAGE_BYTES}_limit': 500000000,
                f'{UsageType.ASR_SECONDS}_limit': 120,
                f'{UsageType.MT_CHARACTERS}_limit': 5,
            }
        }
        with patch(
            'kobo.apps.user_reports.tasks.get_organizations_effective_limits',
            return_value=mock_limits
        ):
            cache.clear()
            refresh_user_report_snapshots()
            self.client.login(username='adminuser', password='pass')
            someuser_data = self._get_someuser_data()

        service_usage = someuser_data['service_usage']
        # Assert total usage counts from the snapshot
        self.assertEqual(service_usage['total_submission_count']['current_period'], 15)
        self.assertEqual(service_usage['total_submission_count']['all_time'], 150)
        self.assertEqual(service_usage['total_storage_bytes'], 200000000)
        self.assertEqual(
            service_usage['total_nlp_usage']['asr_seconds_current_period'], 100
        )
        self.assertEqual(service_usage['total_nlp_usage']['asr_seconds_all_time'], 180)
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
        self.assertEqual(balances['asr_seconds']['balance_value'], 20)
        self.assertEqual(balances['asr_seconds']['balance_percent'], 83)

        # MT Characters balance: 0 / 5 = 0, so 0% and not exceeded.
        self.assertIsNotNone(balances['mt_characters'])
        self.assertFalse(balances['mt_characters']['exceeded'])
        self.assertEqual(balances['mt_characters']['effective_limit'], 5)
        self.assertEqual(balances['mt_characters']['balance_value'], 5)
        self.assertEqual(balances['mt_characters']['balance_percent'], 0)

    def test_organization_data_is_correctly_returned(self):
        someuser_data = self._get_someuser_data()

        organization_data = someuser_data['organization']

        self.assertEqual(
            organization_data['name'], self.someuser.organization.name
        )
        self.assertEqual(
            organization_data['uid'], str(self.someuser.organization.id)
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

        # Create a submission counter entry to simulate usage
        DailyXFormSubmissionCounter.objects.create(
            user_id=self.someuser.id,
            date=timezone.now().date(),
            counter=10
        )

        # Mock the `get_organizations_effective_limits` function
        # to return a predefined limit
        mock_limits = {
            self.someuser.organization.id: {
                f'{UsageType.SUBMISSION}_limit': 1,
                f'{UsageType.STORAGE_BYTES}_limit': 500000000,
                f'{UsageType.ASR_SECONDS}_limit': 120,
                f'{UsageType.MT_CHARACTERS}_limit': 5,
            }
        }
        with patch(
            'kobo.apps.user_reports.tasks.get_organizations_effective_limits',
            return_value=mock_limits
        ):
            cache.clear()
            refresh_user_report_snapshots()

            self.client.login(username='adminuser', password='pass')
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

        refresh_user_reports_materialized_view(concurrently=False)

        # Verify `accepted_tos` has been set to True
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data['results']
        self.assertTrue(results[0]['accepted_tos'])

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


class UserReportsFilterAndOrderingTestCase(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='adminuser', password='pass')
        self.url = reverse(self._get_endpoint('api_v2:user-reports-list'))

        self.someuser = User.objects.get(username='someuser')
        self.organization = self.someuser.organization

        baker.make(BillingAndUsageSnapshot, organization_id=self.organization.id)

        refresh_user_reports_materialized_view(concurrently=False)

    def _get_results(self, params=None):
        params = params or {}
        resp = self.client.get(self.url, params)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        return resp.json()

    def test_username_prefix_filter(self):
        res = self._get_results({'q': 'username__icontains:some'})
        self.assertEqual(res['count'], 1)
        self.assertEqual(res['results'][0]['username'], 'someuser')

    def test_email_prefix_filter(self):
        res = self._get_results({'q': 'email__icontains:some@user'})
        self.assertEqual(res['count'], 1)
        self.assertEqual(res['results'][0]['email'], 'some@user.com')

    def test_date_joined_gte_and_lte_filters(self):
        all_res = self._get_results()
        res_all = self._get_results({'q': 'date_joined__gte:2012-01-01'})
        self.assertLessEqual(res_all['count'], all_res['count'])

        res_none = self._get_results({'q': 'date_joined__gte:3020-01-01'})
        self.assertEqual(res_none['count'], 0)

    def test_storage_bytes_gte_and_lte_filters(self):
        # Update someuser's storage to simulate storage usage
        UserProfile.objects.filter(user_id=self.someuser.id).update(
            attachment_storage_bytes=123456789
        )
        refresh_user_report_snapshots()

        resp_gte = self._get_results(
            {'q': 'service_usage__total_storage_bytes__gte:100000000'}
        )
        self.assertTrue(any(r['username'] == 'someuser' for r in resp_gte['results']))

        resp_lte = self._get_results(
            {'q': 'service_usage__total_storage_bytes__lte:200000000'}
        )
        self.assertTrue(any(r['username'] == 'someuser' for r in resp_lte['results']))

    def test_current_period_submissions_gte_and_lte_filters(self):
        # Create a submission counter entry to simulate usage
        DailyXFormSubmissionCounter.objects.create(
            user_id=self.someuser.id,
            date=timezone.now().date(),
            counter=5
        )
        refresh_user_report_snapshots()

        resp_gte = self._get_results(
            {'q': 'service_usage__total_submission_count__current_period__gte:4'}
        )
        self.assertTrue(any(r['username'] == 'someuser' for r in resp_gte['results']))

        resp_lte = self._get_results(
            {'q': 'service_usage__total_submission_count__current_period__lte:5'}
        )
        self.assertTrue(any(r['username'] == 'someuser' for r in resp_lte['results']))

    def test_balances_nested_json_filter(self):
        """
        Test filtering by nested balances JSON value
        """
        DailyXFormSubmissionCounter.objects.create(
            user_id=self.someuser.id,
            date=timezone.now().date(),
            counter=1
        )

        with patch(
            'kobo.apps.user_reports.tasks.get_organizations_effective_limits'
        ) as mock_limits:
            mock_limits.return_value = {
                self.someuser.organization.id: {
                    f'{UsageType.SUBMISSION}_limit': 5000,
                    f'{UsageType.STORAGE_BYTES}_limit': 31011593,
                    f'{UsageType.ASR_SECONDS}_limit': 600,
                    f'{UsageType.MT_CHARACTERS}_limit': 6000,
                }
            }
            refresh_user_report_snapshots()
            res = self._get_results(
                {'q': 'service_usage__balances__submission__balance_value__lte:4999'}
            )
            self.assertTrue(any(r['username'] == 'someuser' for r in res['results']))

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    def test_subscriptions_nested_json_filter(self):
        # Create and add a subscription to someuser
        from djstripe.enums import BillingScheme
        from djstripe.models import Customer

        self.customer = baker.make(Customer, subscriber=self.organization)
        self.subscription = baker.make(
            'djstripe.Subscription',
            customer=self.customer,
            items__price__livemode=False,
            items__price__billing_scheme=BillingScheme.per_unit,
            livemode=False,
            metadata={'organization_id': str(self.organization.id)},
        )
        refresh_user_reports_materialized_view(concurrently=False)

        # Filter by subscription ID
        res = self._get_results(
            {'q': f'subscriptions[]__id:{self.subscription.id}'}
        )
        self.assertTrue(any(r['username'] == 'someuser' for r in res['results']))

        # Filter by subscription status
        res = self._get_results(
            {'q': f'subscriptions[]__status:{self.subscription.status}'}
        )
        self.assertTrue(any(r['username'] == 'someuser' for r in res['results']))
