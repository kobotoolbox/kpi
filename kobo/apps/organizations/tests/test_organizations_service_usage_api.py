from ddt import data, ddt, unpack
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
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
        User.objects.create_user(
            username='bob', password='bob', email='bob@bob.com'
        )

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

    def test_check_api_response(self):
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
