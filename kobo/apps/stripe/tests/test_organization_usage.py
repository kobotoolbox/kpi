import timeit

from dateutil.relativedelta import relativedelta
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from djstripe.models import Customer, Price, Product, Subscription, SubscriptionItem
from model_bakery import baker

from kobo.apps.organizations.models import Organization, OrganizationUser
from kobo.apps.trackers.submission_utils import create_mock_assets, add_mock_submissions
from kpi.tests.api.v2.test_api_service_usage import ServiceUsageAPIBase


class OrganizationUsageAPITestCase(ServiceUsageAPIBase):
    """
    Test organization service usage when Stripe is enabled.

    Note: this class lives here (despite testing the Organizations endpoint) so that it will *only* run
    when Stripe is installed.
    """

    user_count = 5
    assets_per_user = 5
    submissions_per_asset = 5
    org_id = 'orgAKWMFskafsngf'

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.now = timezone.now()

        anotheruser = User.objects.get(username='anotheruser')
        organization = baker.make(Organization, id=cls.org_id, name='test organization')
        organization.add_user(cls.anotheruser, is_admin=True)
        assets = create_mock_assets([cls.anotheruser], cls.assets_per_user)

        cls.customer = baker.make(Customer, subscriber=organization, livemode=False)
        organization.save()

        users = baker.make(User, _quantity=cls.user_count - 1, _bulk_create=True)
        baker.make(
            OrganizationUser,
            user=users.__iter__(),
            organization=organization,
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

    def generate_subscription(self, metadata: dict):
        """Create a subscription for a product with custom metadata"""
        product = baker.make(Product, active=True, metadata={
            'product_type': 'plan',
            **metadata,
        })
        price = baker.make(
            Price,
            active=True,
            id='price_sfmOFe33rfsfd36685657',
            product=product,
        )

        subscription_item = baker.make(SubscriptionItem, price=price, quantity=1, livemode=False)
        baker.make(
            Subscription,
            customer=self.customer,
            status='active',
            items=[subscription_item],
            livemode=False,
            billing_cycle_anchor=self.now - relativedelta(weeks=2),
            current_period_end=self.now + relativedelta(weeks=2),
            current_period_start=self.now - relativedelta(weeks=2),
        )

    def test_usage_doesnt_include_org_users_without_subscription(self):
        """
        Test that the endpoint *only* returns usage for the logged-in user
        if they don't have a subscription that includes Organizations.
        """
        response = self.client.get(self.detail_url)
        # without a plan, the user should only see their usage
        assert response.data['total_submission_count']['all_time'] == self.expected_submissions_single
        assert response.data['total_submission_count']['current_month'] == self.expected_submissions_single
        assert response.data['total_storage_bytes'] == (
            self.expected_file_size() * self.expected_submissions_single
        )

    def test_usage_for_plans_with_org_access(self):
        """
        Test that the endpoint aggregates usage for each user in the organization
        when viewing /service_usage/{organization_id}/
        """

        self.generate_subscription(
            {
                'plan_type': 'enterprise',
                'organizations': True,
            }
        )

        # the user should see usage for everyone in their org
        response = self.client.get(self.detail_url)
        assert response.data['total_submission_count']['current_month'] == self.expected_submissions_multi
        assert response.data['total_submission_count']['all_time'] == self.expected_submissions_multi
        assert response.data['total_storage_bytes'] == (
            self.expected_file_size() * self.expected_submissions_multi
        )

    def test_doesnt_include_org_users_with_invalid_plan(self):
        """
        Test that the endpoint *doesn't* aggregates usage for the organization
        when subscribed to a product that doesn't include org access
        """

        self.generate_subscription({})

        response = self.client.get(self.detail_url)
        # without the proper subscription, the user should only see their usage
        assert response.data['total_submission_count']['current_month'] == self.expected_submissions_single
        assert response.data['total_submission_count']['all_time'] == self.expected_submissions_single
        assert response.data['total_storage_bytes'] == (
            self.expected_file_size() * self.expected_submissions_single
        )

    def test_endpoint_speed(self):
        # get the average request time for 10 hits to the endpoint
        single_user_time = timeit.timeit(lambda: self.client.get(self.detail_url), number=10)

        self.generate_subscription(
            {
                'plan_type': 'enterprise',
                'organizations': True,
            }
        )

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
        self.generate_subscription(
            {
                'plan_type': 'enterprise',
                'organizations': True,
            }
        )

        response = self.client.get(self.detail_url)
        assert response.data['total_submission_count']['current_month'] == self.expected_submissions_multi
        assert response.data['total_submission_count']['all_time'] == self.expected_submissions_multi
        assert response.data['total_storage_bytes'] == (
            self.expected_file_size() * self.expected_submissions_multi
        )

        # add some submissions to a new asset
        assets = create_mock_assets([self.anotheruser], self.assets_per_user)
        add_mock_submissions(assets, self.submissions_per_asset)

        # make sure the second request doesn't reflect the additional submissions
        response = self.client.get(self.detail_url)
        assert response.data['total_submission_count']['current_month'] == self.expected_submissions_multi
        assert response.data['total_submission_count']['all_time'] == self.expected_submissions_multi
        assert response.data['total_storage_bytes'] == (
            self.expected_file_size() * self.expected_submissions_multi
        )
