import pytest
from ddt import data, ddt, unpack
from django.conf import settings
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.constants import UsageType
from kpi.models import Asset
from kpi.tests.test_usage_calculator import BaseServiceUsageTestCase


@ddt
class OrganizationServiceUsageAPITestCase(BaseServiceUsageTestCase):
    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        cache.clear()
        self.url = reverse(
            self._get_endpoint('organizations-service-usage'),
            kwargs={'id': self.organization.id}
        )

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.organization = cls.anotheruser.organization
        cls.organization.mmo_override = True
        cls.organization.save(update_fields=['mmo_override'])
        cls.organization.add_user(cls.someuser, is_admin=True)

        # Alice is a non-admin member of anotheruser's organization
        alice = User.objects.create_user(
            username='alice', password='alice', email='alice@alice.com'
        )
        cls.organization.add_user(alice, is_admin=False)

        # bob is external to anotheruser's organization
        User.objects.create_user(username='bob', password='bob', email='bob@bob.com')

    def test_anonymous_user(self):
        """
        Test that the endpoint is forbidden to anonymous user
        """
        self.client.logout()
        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @data(
        ('someuser', status.HTTP_200_OK),
        ('anotheruser', status.HTTP_200_OK),
        ('alice', status.HTTP_200_OK),
        ('bob', status.HTTP_404_NOT_FOUND),
    )
    @unpack
    def test_permissions(self, username, expected_status_code):
        user = User.objects.get(username=username)
        self.client.force_login(user)

        response = self.client.get(self.url)
        assert response.status_code == expected_status_code

    @override_settings(
        STRIPE_ENABLED=False,
    )
    def test_check_api_response_without_stripe(self):
        """
        Test endpoint returns accurate data for all org members
        """

        self._create_and_set_asset()
        self.add_nlp_trackers()
        self.add_submissions(count=1)

        response = self.client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['total_submission_count']['current_period'] == 1
        assert response.data['total_submission_count']['all_time'] == 1
        assert response.data['total_nlp_usage']['asr_seconds_current_period'] == 4586
        assert response.data['total_nlp_usage']['asr_seconds_all_time'] == 4728
        assert response.data['total_nlp_usage']['mt_characters_current_period'] == 5473
        assert response.data['total_nlp_usage']['mt_characters_all_time'] == 6726
        assert response.data['total_storage_bytes'] == self.expected_file_size()

        # Without stripe, there are no usage limits and
        # therefore balances should all be empty
        for usage_type, _ in UsageType.choices:
            assert response.data['balances'][usage_type] is None

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    def test_check_api_response_with_stripe(self):
        """
        Test the endpoint aggregates usage balances correctly when stripe is enabled
        """
        from kobo.apps.stripe.tests.utils import generate_plan_subscription

        standard_limit = 5
        storage_limit = 1
        standard_usage = 1
        product_metadata = {
            'mmo_enabled': 'true',
            'plan_type': 'enterprise',
            'asr_seconds_limit': standard_limit,
            'mt_characters_limit': standard_limit,
            'submission_limit': standard_limit,
            'storage_bytes_limit': storage_limit,
        }
        generate_plan_subscription(self.organization, product_metadata)

        self._create_and_set_asset()
        self.add_nlp_trackers(standard_usage, standard_usage, 0, 0)
        self.add_submissions(count=1)

        url = reverse(self._get_endpoint('service-usage-list'))
        response = self.client.get(url)

        for usage_type in [
            UsageType.SUBMISSION,
            UsageType.ASR_SECONDS,
            UsageType.MT_CHARACTERS,
        ]:
            assert (
                response.data['balances'][usage_type]['effective_limit']
                == standard_limit
            )
            assert (
                response.data['balances'][usage_type]['balance_value']
                == standard_limit - standard_usage
            )
            assert (
                response.data['balances'][usage_type]['balance_percent']
                == standard_usage / standard_limit * 100
            )
            assert not response.data['balances'][usage_type]['exceeded']
        assert (
            response.data['balances'][UsageType.STORAGE_BYTES]['effective_limit']
            == storage_limit
        )
        assert (
            response.data['balances'][UsageType.STORAGE_BYTES]['balance_value']
            == storage_limit - self.expected_file_size()
        )
        assert (
            response.data['balances'][UsageType.STORAGE_BYTES]['balance_percent']
            == int(self.expected_file_size() / storage_limit) * 100
        )
        assert response.data['balances'][UsageType.STORAGE_BYTES]['exceeded']

    def test_multiple_forms(self):
        """
        Test that the endpoint functions with multiple assets and the data is
        aggregated properly with
        """
        self._create_and_set_asset()
        self.add_submissions(count=1)

        self._create_and_set_asset()
        self.add_submissions()

        response = self.client.get(self.url)
        assert response.data['total_submission_count']['current_period'] == 3
        assert response.data['total_submission_count']['all_time'] == 3
        assert response.data['total_storage_bytes'] == (
            self.expected_file_size() * 3
        )

    @override_settings(
        CACHES={'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}}
    )
    def test_service_usages_with_projects_in_trash_bin(self):
        self.test_multiple_forms()
        # Simulate trash bin
        for asset in self.anotheruser.assets.all():
            asset.pending_delete = True
            asset.save(
                update_fields=['pending_delete'],
                create_version=False,
                adjust_content=False,
            )
            if asset.has_deployment:
                asset.deployment.xform.pending_delete = True
                asset.deployment.xform.save(update_fields=['pending_delete'])

        response = self.client.get(self.url)

        assert response.data['total_submission_count']['current_period'] == 3
        assert response.data['total_submission_count']['all_time'] == 3
        assert response.data['total_storage_bytes'] == 0

    def test_no_data(self):
        """
        Test the endpoint functions when assets have no data
        """
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['total_submission_count']['current_period'] == 0
        assert response.data['total_submission_count']['all_time'] == 0
        assert response.data['total_nlp_usage']['asr_seconds_all_time'] == 0
        assert response.data['total_storage_bytes'] == 0

    def test_no_deployment(self):
        """
        Test the endpoint does not throw a 500 error if an asset is not deployed
        """
        Asset.objects.create(
            content={
                'survey': [
                    {
                        'type': 'audio',
                        'label': 'q1',
                        'required': 'false',
                        '$kuid': 'abcd',
                    },
                    {
                        'type': 'file',
                        'label': 'q2',
                        'required': 'false',
                        '$kuid': 'efgh',
                    },
                ]
            },
            owner=self.anotheruser,
            asset_type='survey',
        )
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['total_submission_count']['current_period'] == 0
        assert response.data['total_submission_count']['all_time'] == 0
        assert response.data['total_nlp_usage']['asr_seconds_all_time'] == 0
        assert response.data['total_storage_bytes'] == 0
