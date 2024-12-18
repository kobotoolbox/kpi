from django.test import override_settings
from django.urls import reverse
from rest_framework import status

from kpi.models import Asset
from kpi.tests.test_usage_calculator import BaseServiceUsageTestCase


class ServiceUsageAPITestCase(BaseServiceUsageTestCase):
    def test_anonymous_user(self):
        """
        Test that the endpoint is forbidden to anonymous user
        """
        self.client.logout()
        url = reverse(self._get_endpoint('service-usage-list'))
        response = self.client.get(url)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_check_api_response(self):
        """
        Test the endpoint aggregates all data correctly
        """
        self._create_asset()
        self.add_nlp_trackers()
        self.add_submissions(count=1)

        url = reverse(self._get_endpoint('service-usage-list'))
        response = self.client.get(url)

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
        self._create_asset()
        self.add_submissions(count=1)

        self._create_asset()
        self.add_submissions()

        url = reverse(self._get_endpoint('service-usage-list'))
        response = self.client.get(url)
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

        # Retry endpoint
        url = reverse(self._get_endpoint('service-usage-list'))
        response = self.client.get(url)

        assert response.data['total_submission_count']['current_period'] == 3
        assert response.data['total_submission_count']['all_time'] == 3
        assert response.data['total_storage_bytes'] == 0

    def test_no_data(self):
        """
        Test the endpoint functions when assets have no data
        """
        self.client.login(username='anotheruser', password='anotheruser')
        url = reverse(self._get_endpoint('service-usage-list'))
        response = self.client.get(url)
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
        self.client.login(username='anotheruser', password='anotheruser')
        url = reverse(self._get_endpoint('service-usage-list'))
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['total_submission_count']['current_period'] == 0
        assert response.data['total_submission_count']['all_time'] == 0
        assert response.data['total_nlp_usage']['asr_seconds_all_time'] == 0
        assert response.data['total_storage_bytes'] == 0
