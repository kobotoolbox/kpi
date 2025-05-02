import calendar
import timeit
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from dateutil.relativedelta import relativedelta
from ddt import data, ddt, unpack
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from djstripe.models import Customer
from freezegun import freeze_time
from model_bakery import baker
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization, OrganizationUser
from kobo.apps.stripe.tests.utils import (
    generate_mmo_subscription,
    generate_plan_subscription,
)
from kobo.apps.trackers.tests.submission_utils import (
    add_mock_submissions,
    create_mock_assets,
)
from kpi.tests.api.v2.test_api_asset_usage import AssetUsageAPITestCase
from kpi.tests.kpi_test_case import BaseTestCase
from kpi.tests.test_usage_calculator import BaseServiceUsageTestCase


class OrganizationServiceUsageAPIMultiUserTestCase(BaseServiceUsageTestCase):
    """
    Test organization service usage when Stripe is enabled.

    Note: this class lives here (despite testing the Organizations endpoint) so that it will *only* run
    when Stripe is installed.
    """

    names = ['alice', 'bob']
    user_count = len(names)
    assets_per_user = 2
    submissions_per_asset = 2
    org_id = 'orgAKWMFskafsngf'

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.now = timezone.now()

        cls.organization = baker.make(
            Organization, id=cls.org_id, name='test organization', mmo_override=True
        )
        cls.organization.add_user(cls.anotheruser, is_admin=True)
        assets = create_mock_assets([cls.anotheruser], cls.assets_per_user)

        users = baker.make(
            User,
            username=iter(cls.names),
            _quantity=cls.user_count - 1,
            _bulk_create=True,
        )
        baker.make(
            OrganizationUser,
            user=users.__iter__(),
            organization=cls.organization,
            is_admin=False,
            _quantity=cls.user_count - 1,
            _bulk_create=True,
        )
        assets = assets + create_mock_assets(users, cls.assets_per_user)
        add_mock_submissions(assets, cls.submissions_per_asset)

    def setUp(self):
        super().setUp()
        url = reverse(self._get_endpoint('organizations-list'))
        self.detail_url = f'{url}{self.org_id}/service_usage/'
        self.expected_submissions_single = self.assets_per_user * self.submissions_per_asset
        self.expected_submissions_multi = self.expected_submissions_single * self.user_count

    def tearDown(self):
        cache.clear()

    def test_usage_for_plans_with_org_access(self):
        """
        Test that the endpoint aggregates usage for each user in the organization
        when viewing /service_usage/{organization_id}/
        """

        generate_mmo_subscription(self.organization)

        # the user should see usage for everyone in their org
        response = self.client.get(self.detail_url)
        assert (
            response.data['total_submission_count']['current_period']
            == self.expected_submissions_multi
        )
        assert (
            response.data['total_submission_count']['all_time']
            == self.expected_submissions_multi
        )
        assert response.data['total_storage_bytes'] == (
            self.expected_file_size() * self.expected_submissions_multi
        )

    @pytest.mark.performance
    def test_endpoint_speed(self):
        # get the average request time for 10 hits to the endpoint
        single_user_time = timeit.timeit(lambda: self.client.get(self.detail_url), number=10)

        generate_mmo_subscription(self.organization)

        # get the average request time for 10 hits to the endpoint
        multi_user_time = timeit.timeit(lambda: self.client.get(self.detail_url), number=10)
        assert single_user_time < 1.5
        assert multi_user_time < 2
        assert multi_user_time < single_user_time * 2

    @override_settings(ENDPOINT_CACHE_DURATION=10000)
    def test_endpoint_is_cached(self):
        """
        Test that multiple hits to the endpoint from the same origin are properly cached
        """
        generate_mmo_subscription(self.organization)

        first_response = self.client.get(self.detail_url)
        assert (
            first_response.data['total_submission_count']['current_period']
            == self.expected_submissions_multi
        )
        assert (
            first_response.data['total_submission_count']['all_time']
            == self.expected_submissions_multi
        )
        assert first_response.data['total_storage_bytes'] == (
            self.expected_file_size() * self.expected_submissions_multi
        )

        # add some submissions to a new asset
        assets = create_mock_assets([self.anotheruser], self.assets_per_user)
        add_mock_submissions(assets, self.submissions_per_asset)

        # make sure the second request doesn't reflect the additional submissions
        response = self.client.get(self.detail_url)
        assert (
            response.data['total_submission_count']['current_period']
            == self.expected_submissions_multi
        )
        assert (
            response.data['total_submission_count']['all_time']
            == self.expected_submissions_multi
        )
        assert response.data['total_storage_bytes'] == (
            self.expected_file_size() * self.expected_submissions_multi
        )


@ddt
class OrganizationServiceUsageAPITestCase(BaseServiceUsageTestCase):
    org_id = 'orgAKWMFskafsngf'

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.now = timezone.now()

        cls.organization = baker.make(
            Organization, id=cls.org_id, name='test organization'
        )
        cls.organization.add_user(cls.anotheruser, is_admin=True)
        cls.asset = create_mock_assets([cls.anotheruser])[0]

    def setUp(self):
        super().setUp()
        url = reverse(self._get_endpoint('organizations-list'))
        self.detail_url = f'{url}{self.org_id}/service_usage/'

    def tearDown(self):
        cache.clear()

    def test_default_plan_period(self):
        """
        Default community plan cycle dates should line up with calendar month
        (first of this month to first of next month)
        """

        num_submissions = 5
        add_mock_submissions([self.asset], num_submissions)

        response = self.client.get(self.detail_url)
        now = timezone.now()
        first_of_month = datetime(now.year, now.month, 1, tzinfo=ZoneInfo('UTC'))
        first_of_next_month = first_of_month + relativedelta(months=1)

        assert (
            response.data['total_submission_count']['current_period'] == num_submissions
        )
        assert response.data['current_period_start'] == first_of_month.isoformat()
        assert response.data['current_period_end'] == first_of_next_month.isoformat()

    def test_monthly_plan_period(self):
        """
        Returned cycle dates for monthly plan should be the same as
        the dates stored on the subscription object
        """
        subscription = generate_plan_subscription(
            self.organization
        )
        num_submissions = 5
        add_mock_submissions([self.asset], num_submissions)

        response = self.client.get(self.detail_url)

        assert (
            response.data['total_submission_count']['current_period'] == num_submissions
        )
        assert (
            response.data['current_period_start']
            == subscription.current_period_start.isoformat()
        )
        assert (
            response.data['current_period_end']
            == subscription.current_period_end.isoformat()
        )

    def test_annual_plan_period(self):
        """
        Returned yearly cycle dates for annual plan should be the same as
        the dates stored on the subscription object
        """
        subscription = generate_plan_subscription(
            self.organization, interval='year'
        )
        num_submissions = 5
        add_mock_submissions([self.asset], num_submissions)

        response = self.client.get(self.detail_url)

        assert (
            response.data['total_submission_count']['current_period'] == num_submissions
        )
        assert (
            response.data['current_period_start']
            == subscription.current_period_start.isoformat()
        )
        assert (
            response.data['current_period_end']
            == subscription.current_period_end.isoformat()
        )

    def test_plan_canceled_this_month(self):
        """
        When a user cancels their subscription, they revert to the default community plan
        with a billing cycle anchored to the end date of their canceled subscription
        """

        subscription = generate_plan_subscription(self.organization, age_days=30)

        num_submissions = 5
        add_mock_submissions([self.asset], num_submissions, 15)

        canceled_at = timezone.now()
        subscription.status = 'canceled'
        subscription.ended_at = canceled_at
        subscription.save()

        current_billing_period_end = canceled_at + relativedelta(months=1)

        response = self.client.get(self.detail_url)

        assert response.data['total_submission_count']['current_period'] == 0
        assert response.data['current_period_start'] == canceled_at.isoformat()
        assert (
            response.data['current_period_end']
            == current_billing_period_end.isoformat()
        )

    def test_plan_canceled_last_month(self):
        """
        Validate that the service usage behaviour one month after plan
        cancellation follows the same logic as `test_plan_canceled_this_month`.
        """

        subscription = generate_plan_subscription(self.organization, age_days=60)

        num_submissions = 5
        add_mock_submissions([self.asset], num_submissions)

        canceled_at = timezone.now() - relativedelta(days=45)
        subscription.status = 'canceled'
        subscription.ended_at = canceled_at
        subscription.save()

        current_billing_period_start = canceled_at + relativedelta(months=1)
        current_billing_period_end = current_billing_period_start + relativedelta(
            months=1
        )
        # if the beginning of billing period is the last day of a month,
        # we need to be sure that the end of billing period is also the last
        # day of the following month.
        last_day_of_previous_month = calendar.monthrange(
            current_billing_period_start.year,
            current_billing_period_start.month,
        )[1]
        if last_day_of_previous_month == current_billing_period_start.day:
            last_day_of_billing_period = calendar.monthrange(
                current_billing_period_end.year,
                current_billing_period_end.month,
            )[1]
            current_billing_period_end = current_billing_period_end.replace(
                day=last_day_of_billing_period
            )

        response = self.client.get(self.detail_url)

        assert (
            response.data['total_submission_count']['current_period'] == num_submissions
        )
        assert (
            response.data['current_period_start']
            == current_billing_period_start.isoformat()
        )
        assert (
            response.data['current_period_end']
            == current_billing_period_end.isoformat()
        )

    def test_plan_canceled_edge_date(self):
        """
        If a plan is canceled on the last day of a 31-day month, we want the subsequent
        billing cycle to end on the last day of the next month, but we also need to make
        sure the cycle starts on the cancelation date
        """
        frozen_datetime_now = datetime(
            year=2024,
            month=9,
            day=1,
            tzinfo=ZoneInfo('UTC'),
        )
        subscribe_date = frozen_datetime_now.replace(month=8, day=1)
        cancel_date = frozen_datetime_now.replace(month=8, day=31)
        with freeze_time(subscribe_date):
            subscription = generate_plan_subscription(self.organization)

        subscription.status = 'canceled'
        subscription.ended_at = cancel_date
        subscription.save()

        with freeze_time(frozen_datetime_now):
            response = self.client.get(self.detail_url)
        current_period_start = datetime.fromisoformat(
            response.data['current_period_start']
        )
        current_period_end = datetime.fromisoformat(response.data['current_period_end'])

        assert current_period_start.month == cancel_date.month
        assert current_period_start.day == cancel_date.day
        assert current_period_end.month == 9
        assert current_period_end.day == 30

    @data(
        # regular year
        ('2024-11-15', '2024-10-31', '2024-11-30'),
        ('2024-12-15', '2024-11-30', '2024-12-31'),
        ('2025-01-15', '2024-12-31', '2025-01-31'),
        ('2025-02-15', '2025-01-31', '2025-02-28'),
        ('2025-03-15', '2025-02-28', '2025-03-31'),
        ('2025-04-15', '2025-03-31', '2025-04-30'),
        ('2025-05-15', '2025-04-30', '2025-05-31'),
        ('2025-06-15', '2025-05-31', '2025-06-30'),
        ('2025-07-15', '2025-06-30', '2025-07-31'),
        ('2025-08-15', '2025-07-31', '2025-08-31'),
        ('2025-09-15', '2025-08-31', '2025-09-30'),
        ('2025-10-15', '2025-09-30', '2025-10-31'),
        ('2025-11-15', '2025-10-31', '2025-11-30'),
        # leap year, edge case with February
        ('2028-02-15', '2028-01-31', '2028-02-29'),
        ('2028-03-15', '2028-02-29', '2028-03-31'),
    )
    @unpack
    def test_billing_cycle_looks_like_stripe_after_plan_cancellation(
        self, fake_now_str, expected_period_start_str, expected_period_end_str
    ):
        """
        Verify that the billing cycle of users who cancelled their plan at the end of
        the month matches Stripe's billing cycle behaviour.

        According to Stripe:
        > A monthly subscription with a billing cycle anchor date of January 31
        > bills the last day of the month closest to the anchor date, so February 28
        > (or February 29 in a leap year), then March 31, April 30, and so on.
        """

        # Fake subscription on Oct 1, 2024
        frozen_subscribe_date = datetime(
            year=2024,
            month=10,
            day=1,
            tzinfo=ZoneInfo('UTC'),
        )
        cancel_date = frozen_subscribe_date.replace(day=31)

        with freeze_time(frozen_subscribe_date):
            subscription = generate_plan_subscription(self.organization)

        # Cancel subscription on Oct 31, 2024
        subscription.status = 'canceled'
        subscription.ended_at = cancel_date
        subscription.save()

        fake_now = datetime.fromisoformat(fake_now_str)
        with freeze_time(fake_now):
            response = self.client.get(self.detail_url)

        current_period_start = datetime.fromisoformat(
            response.data['current_period_start']
        )
        expected_period_start = datetime.fromisoformat(
            expected_period_start_str
        ).replace(tzinfo=ZoneInfo('UTC'))
        current_period_end = datetime.fromisoformat(response.data['current_period_end'])
        expected_period_end = datetime.fromisoformat(
            expected_period_end_str
        ).replace(tzinfo=ZoneInfo('UTC'))

        assert current_period_start == expected_period_start
        assert current_period_end == expected_period_end

    def test_multiple_canceled_plans(self):
        """
        If a user has multiple canceled plans, their default billing cycle
        should be anchored to the end date of the most recently canceled plan
        """
        subscription = generate_plan_subscription(
            self.organization, age_days=60
        )

        subscription.status = 'canceled'
        subscription.ended_at = timezone.now() - relativedelta(days=45)
        subscription.save()

        subscription = generate_plan_subscription(
            self.organization, age_days=40
        )

        subscription.status = 'canceled'
        subscription.ended_at = timezone.now() - relativedelta(days=35)
        subscription.save()

        subscription = generate_plan_subscription(
            self.organization, age_days=30
        )

        canceled_at = timezone.now() - relativedelta(days=20)
        subscription.status = 'canceled'
        subscription.ended_at = canceled_at
        subscription.save()

        current_billing_period_start = canceled_at
        current_billing_period_end = (
            current_billing_period_start + relativedelta(months=1)
        )

        num_submissions = 5
        add_mock_submissions([self.asset], num_submissions, 15)

        response = self.client.get(self.detail_url)

        assert (
            response.data['total_submission_count']['current_period'] == num_submissions
        )
        assert (
            response.data['current_period_start']
            == current_billing_period_start.isoformat()
        )
        assert (
            response.data['current_period_end']
            == current_billing_period_end.isoformat()
        )


class OrganizationAssetUsageAPITestCase(AssetUsageAPITestCase):
    """
    Test organization asset usage when Stripe is enabled.
    """

    def setUp(self):
        self.org_id = 'orgBGRFJskafsngf'
        self.url = reverse(self._get_endpoint('organizations-list'))
        self.detail_url = f'{self.url}{self.org_id}/asset_usage/'
        self.organization = baker.make(
            Organization, id=self.org_id, name='test organization'
        )

        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.newuser = baker.make(User, username='newuser')
        self.organization.add_user(self.anotheruser, is_admin=True)
        baker.make(Customer, subscriber=self.organization)
        self.client.force_login(self.anotheruser)

    def test_unauthorized_user(self):
        self.client.logout()
        response = self.client.get(self.detail_url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        self.client.force_login(self.anotheruser)

    def test_nonexistent_organization(self):
        non_org_id = 'lkdjalkfewkl'
        url_with_non_org_id = f'{self.url}{non_org_id}/asset_usage/'
        response = self.client.get(url_with_non_org_id)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_user_not_member_of_organization(self):
        self.client.force_login(self.someuser)
        response = self.client.get(self.detail_url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_successful_retrieval(self):
        generate_mmo_subscription(self.organization)
        create_mock_assets([self.anotheruser])
        response = self.client.get(self.detail_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['results'][0]['asset__name'] == 'test'
        assert response.data['results'][0]['deployment_status'] == 'deployed'

    def test_aggregates_usage_for_mmo(self):
        generate_mmo_subscription(self.organization)
        self.organization.add_user(self.newuser)
        # create 2 additional assets, one per user
        create_mock_assets([self.anotheruser, self.newuser])
        response = self.client.get(self.detail_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 2


class OrganizationsModelIntegrationTestCase(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.organization = self.someuser.organization

    def test_is_mmo_subscription_logic(self):
        product_metadata = {
            'mmo_enabled': 'false',
        }
        subscription = generate_plan_subscription(
            self.organization, metadata=product_metadata
        )
        assert self.organization.is_mmo is False
        subscription.status = 'canceled'
        subscription.ended_at = timezone.now()
        subscription.save()

        product_metadata['mmo_enabled'] = 'true'
        mmo_subscription = generate_plan_subscription(
            self.organization, metadata=product_metadata
        )
        assert self.organization.is_mmo is True

        # Ensure non-plan subscriptions are ignored
        addon_metadata = {'product_type': 'addon'}
        generate_plan_subscription(self.organization, metadata=addon_metadata)
        assert self.organization.is_mmo is True

        # ensure inactive mmo-enabled subscriptions are ignored
        mmo_subscription.status = 'canceled'
        mmo_subscription.save()
        assert self.organization.is_mmo is False
