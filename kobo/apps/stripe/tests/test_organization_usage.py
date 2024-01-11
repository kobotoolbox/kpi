import timeit

from dateutil.relativedelta import relativedelta
from django.contrib.auth.models import User
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

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.now = timezone.now()

        cls.client = cls.client_class()
        cls.anotheruser = User.objects.get(username='anotheruser')
        cls.organization = baker.make(Organization, id='orgAKWMFskafsngf', name='test organization')
        cls.organization.add_user(cls.anotheruser, is_admin=True)
        assets = create_mock_assets([cls.anotheruser], cls.assets_per_user)

        cls.customer = baker.make(Customer, subscriber=cls.organization, livemode=False)
        cls.organization.save()
        product = baker.make(Product, active=True, metadata={
            'product_type': 'plan',
            'plan_type': 'enterprise',
            'organizations': True,
        })
        cls.price = baker.make(
            Price,
            active=True,
            id='price_sfmOFe33rfsfd36685657',
            product=product,
        )

        users = baker.make(User, _quantity=cls.user_count - 1, _bulk_create=True)
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
        self.detail_url = f'{url}{self.organization.id}/service_usage/'
        self.client.login(username='anotheruser', password='anotheruser')

    def test_usage_doesnt_include_org_users_without_subscription(self):
        """
        Test that the endpoint *only* returns usage for the logged-in user
        if they don't have a subscription that includes Organizations.
        """
        # without a plan that includes Organizations, the user should only see their usage
        response = self.client.get(self.detail_url)
        expected_submissions = self.assets_per_user * self.submissions_per_asset
        assert response.data['total_submission_count']['all_time'] == expected_submissions
        assert response.data['total_submission_count']['current_month'] == expected_submissions
        assert response.data['total_storage_bytes'] == (
            self.expected_file_size() * expected_submissions
        )

    def test_usage_for_plans_with_org_access(self):
        """
        Test that the endpoint aggregates usage for each user in the organization
        when viewing /service_usage/{organization_id}/
        """
        # create a subscription that includes Organizations
        subscription_item = baker.make(SubscriptionItem, price=self.price, quantity=1, livemode=False)
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
        self.customer.save()

        expected_submissions = self.assets_per_user * self.submissions_per_asset * self.user_count

        # now the user should see usage for everyone in their org
        response = self.client.get(self.detail_url)
        assert response.data['total_submission_count']['current_month'] == expected_submissions
        assert response.data['total_submission_count']['all_time'] == expected_submissions
        assert response.data['total_storage_bytes'] == (
            self.expected_file_size() * expected_submissions
        )

    def test_endpoint_speed_(self):
        # get the average request time for 10 hits to the endpoint
        single_user_time = timeit.timeit(lambda: self.client.get(self.detail_url), number=40)

        # get the average request time for 10 hits to the endpoint
        multi_user_time = timeit.timeit(lambda: self.client.get(self.detail_url), number=10)
        print(f'Average time for response from organization usage endpoint with one user: {single_user_time}s')
        assert single_user_time < 1.5
        assert multi_user_time < 2
        assert multi_user_time < single_user_time * 2
