# coding: utf-8
import os.path
import uuid

from django.conf import settings
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status

from kpi.models import Asset
from kpi.tests.base_test_case import BaseAssetTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class ServiceUsageAPITestCase(BaseAssetTestCase):
    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self) -> None:
        self.client.login(username='anotheruser', password='anotheruser')
        self.anotheruser = User.objects.get(username='anotheruser')

    def __create_asset(self):
        content_source_asset = {
            'survey': [
                {'type': 'audio', 'label': 'q1', 'required': 'false', '$kuid': 'abcd'},
                {'type': 'file', 'label': 'q2', 'required': 'false', '$kuid': 'efgh'},
            ]
        }
        self.asset = Asset.objects.create(
            content=content_source_asset,
            owner=self.anotheruser,
            asset_type='survey',
        )

        self.asset.deploy(backend='mock', active=True)
        self.asset.save()

        self.asset.deployment.set_namespace(self.URL_NAMESPACE)
        self.submission_list_url = self.asset.deployment.submission_list_url
        self._deployment = self.asset.deployment

    def __add_submission(self):
        submissions = []
        v_uid = self.asset.latest_deployed_version.uid

        submission = {
            '__version__': v_uid,
            'q1': 'audio_conversion_test_clip.mp4',
            'q2': 'audio_conversion_test_image.jpg',
            '_uuid': str(uuid.uuid4()),
            '_attachments': [
                {
                    'id': 1,
                    'download_url': 'http://testserver/anotheruser/audio_conversion_test_clip.mp4',
                    'filename': 'anotheruser/audio_conversion_test_clip.mp4',
                    'mimetype': 'video/mp4',
                },
                {
                    'id': 2,
                    'download_url': 'http://testserver/anotheruser/audio_conversion_test_image.jpg',
                    'filename': 'anotheruser/audio_conversion_test_image.jpg',
                    'mimetype': 'image/jpeg',
                },
            ],
            '_submitted_by': 'anotheruser'
        }
        submissions.append(submission)
        self.asset.deployment.mock_submissions(submissions, flush_db=False)

    def __add_submissions(self):
        submissions = []
        v_uid = self.asset.latest_deployed_version.uid

        submission1 = {
            '__version__': v_uid,
            'q1': 'audio_conversion_test_clip.mp4',
            'q2': 'audio_conversion_test_image.jpg',
            '_uuid': str(uuid.uuid4()),
            '_attachments': [
                {
                    'id': 3,
                    'download_url': 'http://testserver/anotheruser/audio_conversion_test_clip.mp4',
                    'filename': 'anotheruser/audio_conversion_test_clip.mp4',
                    'mimetype': 'video/mp4',
                },
                {
                    'id': 4,
                    'download_url': 'http://testserver/anotheruser/audio_conversion_test_image.jpg',
                    'filename': 'anotheruser/audio_conversion_test_image.jpg',
                    'mimetype': 'image/jpeg',
                },
            ],
            '_submitted_by': 'anotheruser'
        }
        submission2 = {
            '__version__': v_uid,
            'q1': 'audio_conversion_test_clip.mp4',
            'q2': 'audio_conversion_test_image.jpg',
            '_uuid': str(uuid.uuid4()),
            '_attachments': [
                {
                    'id': 5,
                    'download_url': 'http://testserver/anotheruser/audio_conversion_test_clip.mp4',
                    'filename': 'anotheruser/audio_conversion_test_clip.mp4',
                    'mimetype': 'video/mp4',
                },
                {
                    'id': 6,
                    'download_url': 'http://testserver/anotheruser/audio_conversion_test_image.jpg',
                    'filename': 'anotheruser/audio_conversion_test_image.jpg',
                    'mimetype': 'image/jpeg',
                },
            ],
            '_submitted_by': 'anotheruser'
        }

        submissions.append(submission1)
        submissions.append(submission2)

        self.asset.deployment.mock_submissions(submissions, flush_db=False)

    def __expected_file_size(self):
        return os.path.getsize(
            settings.BASE_DIR + '/kpi/tests/audio_conversion_test_clip.mp4'
        ) + os.path.getsize(settings.BASE_DIR + '/kpi/tests/audio_conversion_test_image.jpg')

    def test_anonymous_user(self):
        self.client.logout()
        url = reverse(self._get_endpoint('service-usage-list'))
        response = self.client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_check_api_response(self):
        self.__create_asset()
        self.__add_submission()

        url = reverse(self._get_endpoint('service-usage-list'))
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data['total_submission_count_current_month'] == 1
        assert response.data['total_submission_count_all_time'] == 1
        assert response.data['total_storage_bytes'] == self.__expected_file_size()
        assert len(response.data['per_asset_usage']) == 1

    def test_multiple_forms(self):
        self.__create_asset()
        self.__add_submission()
        self.__create_asset()
        self.__add_submissions()

        url = reverse(self._get_endpoint('service-usage-list'))
        response = self.client.get(url)
        assert len(response.data['per_asset_usage']) == 2
        assert response.data['total_submission_count_current_month'] == 3
        assert response.data['total_submission_count_all_time'] == 3
        assert response.data['total_storage_bytes'] == (self.__expected_file_size() * 3)

    def test_no_data(self):
        self.client.login(username='anotheruser', password='anotheruser')
        url = reverse(self._get_endpoint('service-usage-list'))
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['total_submission_count_current_month'] == 0
        assert response.data['total_submission_count_all_time'] == 0
        assert len(response.data['per_asset_usage']) == 0
        assert response.data['total_storage_bytes'] == 0
