# coding: utf-8
import os.path
import uuid

from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.trackers.models import NLPUsageCounter
from kpi.models import Asset
from kpi.tests.base_test_case import BaseAssetTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class ServiceUsageAPIBase(BaseAssetTestCase):
    """
    This class contains setup logic and utility functions to test submissions/usage
    """
    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    counter = None
    attachment_id = 0

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.anotheruser = User.objects.get(username='anotheruser')
        cls.someuser = User.objects.get(username='someuser')

    def setUp(self):
        super().setUp()
        self.client.login(username='anotheruser', password='anotheruser')

    def _create_asset(self, user=None):
        owner = user or self.anotheruser
        content_source_asset = {
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
        }
        self.asset = Asset.objects.create(
            content=content_source_asset,
            owner=owner,
            asset_type='survey',
        )

        self.asset.deploy(backend='mock', active=True)
        self.asset.save()

        self.asset.deployment.set_namespace(self.URL_NAMESPACE)
        self.submission_list_url = reverse(
            self._get_endpoint('submission-list'),
            kwargs={'format': 'json', 'parent_lookup_asset': self.asset.uid},
        )
        self._deployment = self.asset.deployment

    def add_nlp_trackers(self):
        """
        Add nlp data to an asset
        """
        # this month
        today = timezone.now().date()
        counter_1 = {
            'google_asr_seconds': 4586,
            'google_mt_characters': 5473,
        }
        NLPUsageCounter.objects.create(
            user_id=self.anotheruser.id,
            asset_id=self.asset.id,
            date=today,
            counters=counter_1,
            total_asr_seconds=counter_1['google_asr_seconds'],
            total_mt_characters=counter_1['google_mt_characters'],
        )

        # last month
        last_month = today - relativedelta(months=1)
        counter_2 = {
            'google_asr_seconds': 142,
            'google_mt_characters': 1253,
        }
        NLPUsageCounter.objects.create(
            user_id=self.anotheruser.id,
            asset_id=self.asset.id,
            date=last_month,
            counters=counter_2,
            total_asr_seconds=counter_2['google_asr_seconds'],
            total_mt_characters=counter_2['google_mt_characters'],
        )

    def add_submissions(self, count=2):
        """
        Add one or more submissions to an asset (TWO by default)
        """
        submissions = []
        v_uid = self.asset.latest_deployed_version.uid

        for x in range(count):
            submission = {
                '__version__': v_uid,
                'q1': 'audio_conversion_test_clip.3gp',
                'q2': 'audio_conversion_test_image.jpg',
                '_uuid': str(uuid.uuid4()),
                '_attachments': [
                    {
                        'id': self.attachment_id,
                        'download_url': 'http://testserver/anotheruser/audio_conversion_test_clip.3gp',
                        'filename': 'anotheruser/audio_conversion_test_clip.3gp',
                        'mimetype': 'video/3gpp',
                    },
                    {
                        'id': self.attachment_id + 1,
                        'download_url': 'http://testserver/anotheruser/audio_conversion_test_image.jpg',
                        'filename': 'anotheruser/audio_conversion_test_image.jpg',
                        'mimetype': 'image/jpeg',
                    },
                ],
                '_submitted_by': 'anotheruser',
            }
            # increment the attachment ID for each attachment created
            self.attachment_id = self.attachment_id + 2
            submissions.append(submission)

        self.asset.deployment.mock_submissions(submissions)

    @staticmethod
    def expected_file_size():
        """
        Calculate the expected combined file size for the test audio clip and image
        """
        return os.path.getsize(
            settings.BASE_DIR
            + '/kpi/fixtures/attachments/audio_conversion_test_clip.3gp'
        ) + os.path.getsize(
            settings.BASE_DIR
            + '/kpi/fixtures/attachments/audio_conversion_test_image.jpg'
        )


class ServiceUsageAPITestCase(ServiceUsageAPIBase):
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
        assert response.data['total_submission_count']['current_month'] == 1
        assert response.data['total_submission_count']['all_time'] == 1
        assert (
            response.data['total_nlp_usage']['asr_seconds_current_month']
            == 4586
        )
        assert response.data['total_nlp_usage']['asr_seconds_all_time'] == 4728
        assert (
            response.data['total_nlp_usage']['mt_characters_current_month']
            == 5473
        )
        assert (
            response.data['total_nlp_usage']['mt_characters_all_time'] == 6726
        )
        assert (
            response.data['total_storage_bytes'] == self.expected_file_size()
        )

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
        assert response.data['total_submission_count']['current_month'] == 3
        assert response.data['total_submission_count']['all_time'] == 3
        assert response.data['total_storage_bytes'] == (
            self.expected_file_size() * 3
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

        assert response.data['total_submission_count']['current_month'] == 3
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
        assert response.data['total_submission_count']['current_month'] == 0
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
        assert response.data['total_submission_count']['current_month'] == 0
        assert response.data['total_submission_count']['all_time'] == 0
        assert response.data['total_nlp_usage']['asr_seconds_all_time'] == 0
        assert response.data['total_storage_bytes'] == 0
