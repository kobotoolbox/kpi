import timeit

import pytest
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from djstripe.models import Customer
from model_bakery import baker

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization, OrganizationUser
from kobo.apps.stripe.tests.utils import generate_enterprise_subscription, generate_plan_subscription
from kobo.apps.trackers.submission_utils import create_mock_assets, add_mock_submissions
from kpi.tests.api.v2.test_api_service_usage import ServiceUsageAPIBase
from kpi.tests.api.v2.test_api_asset_usage import AssetUsageAPITestCase
from rest_framework import status



class OrganizationServiceUsageAPITestCase(ServiceUsageAPIBase):
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

        cls.organization = baker.make(Organization, id=cls.org_id, name='test organization')
        cls.organization.add_user(cls.anotheruser, is_admin=True)
        assets = create_mock_assets([cls.anotheruser], cls.assets_per_user)

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
        self.detail_url = f'{url}{self.org_id}/service_usage/'
        self.expected_submissions_single = self.assets_per_user * self.submissions_per_asset
        self.expected_submissions_multi = self.expected_submissions_single * self.user_count

    def tearDown(self):
        cache.clear()

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

        generate_enterprise_subscription(self.organization)

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

        generate_plan_subscription(self.organization)

        response = self.client.get(self.detail_url)
        # without the proper subscription, the user should only see their usage
        assert response.data['total_submission_count']['current_month'] == self.expected_submissions_single
        assert response.data['total_submission_count']['all_time'] == self.expected_submissions_single
        assert response.data['total_storage_bytes'] == (
            self.expected_file_size() * self.expected_submissions_single
        )

    @pytest.mark.performance
    def test_endpoint_speed(self):
        # get the average request time for 10 hits to the endpoint
        single_user_time = timeit.timeit(lambda: self.client.get(self.detail_url), number=10)

        generate_enterprise_subscription(self.organization)

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
        generate_enterprise_subscription(self.organization)

        first_response = self.client.get(self.detail_url)
        assert first_response.data['total_submission_count']['current_month'] == self.expected_submissions_multi
        assert first_response.data['total_submission_count']['all_time'] == self.expected_submissions_multi
        assert first_response.data['total_storage_bytes'] == (
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
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_user_not_member_of_organization(self):
        self.client.force_login(self.someuser)
        response = self.client.get(self.detail_url)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_successful_retrieval(self):
        generate_enterprise_subscription(self.organization)
        create_mock_assets([self.anotheruser])
        response = self.client.get(self.detail_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['results'][0]['asset__name'] == 'test'
        assert response.data['results'][0]['deployment_status'] == 'deployed'

    def test_aggregates_usage_for_enterprise_org(self):
        generate_enterprise_subscription(self.organization)
        self.organization.add_user(self.newuser)
        # create 2 additional assets, one per user
        create_mock_assets([self.anotheruser, self.newuser])
        response = self.client.get(self.detail_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 2

    def test_users_without_enterprise_see_only_their_usage(self):
        generate_plan_subscription(self.organization)
        self.organization.add_user(self.newuser)
        create_mock_assets([self.anotheruser, self.newuser])
        response = self.client.get(self.detail_url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
