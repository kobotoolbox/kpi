import os
import uuid
from datetime import datetime

from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.trackers.models import NLPUsageCounter
from kpi.models import Asset
from kpi.tests.base_test_case import BaseAssetTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class AssetUsageAPITestCase(BaseAssetTestCase):
    fixtures = ['test_data']
    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.anotheruser = User.objects.get(username='anotheruser')
        self.client.login(username='anotheruser', password='anotheruser')

    def __add_nlp_trackers(self):
        """
        Add nlp data to an asset
        """
        # this month
        today = datetime.today()
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

    def __add_submissions(self):
        """
        Adds TWO submissions to an asset
        """
        submissions = []
        v_uid = self.asset.latest_deployed_version.uid

        submission1 = {
            '__version__': v_uid,
            'q1': 'audio_conversion_test_clip.3gp',
            'q2': 'audio_conversion_test_image.jpg',
            '_uuid': str(uuid.uuid4()),
            '_attachments': [
                {
                    'id': 3,
                    'download_url': 'http://testserver/anotheruser/audio_conversion_test_clip.3gp',
                    'filename': 'anotheruser/audio_conversion_test_clip.3gp',
                    'mimetype': 'video/3gpp',
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
            'q1': 'audio_conversion_test_clip.3gp',
            'q2': 'audio_conversion_test_image.jpg',
            '_uuid': str(uuid.uuid4()),
            '_attachments': [
                {
                    'id': 5,
                    'download_url': 'http://testserver/anotheruser/audio_conversion_test_clip.3gp',
                    'filename': 'anotheruser/audio_conversion_test_clip.3gp',
                    'mimetype': 'video/3gpp',
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

        self.asset.deployment.mock_submissions(submissions)

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
        self.submission_list_url = reverse(
            self._get_endpoint('submission-list'),
            kwargs={'parent_lookup_asset': self.asset.uid, 'format': 'json'},
        )

        self._deployment = self.asset.deployment

    def __expected_file_size(self):
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

    def test_anonymous_user(self):
        """
        Test that the endpoint is forbidden to anonymous user
        """
        self.client.logout()
        url = reverse(self._get_endpoint('asset-usage-list'))
        response = self.client.get(url)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_check_api_response(self):
        """
        Test the endpoint aggregates all data correctly
        """
        self.__create_asset()
        self.__add_nlp_trackers()
        self.__add_submissions()

        url = reverse(self._get_endpoint('asset-usage-list'))
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['asset__name'] == ''
        assert (
            response.data['results'][0]['nlp_usage_current_period'][
                'total_nlp_asr_seconds'
            ]
            == 4586
        )
        assert (
            response.data['results'][0]['nlp_usage_current_period'][
                'total_nlp_mt_characters'
            ]
            == 5473
        )
        assert (
            response.data['results'][0]['nlp_usage_all_time']['total_nlp_asr_seconds']
            == 4728
        )
        assert (
            response.data['results'][0]['nlp_usage_all_time']['total_nlp_mt_characters']
            == 6726
        )
        assert (
            response.data['results'][0]['storage_bytes']
            == (
                182255  # audio_conversion_test_clip.3gp
                + 9387  # audio_conversion_test_image.jpg
            )
            * 2  # __add_submissions() adds 2 submissions
        )
        assert response.data['results'][0]['submission_count_current_period'] == 2
        assert response.data['results'][0]['submission_count_all_time'] == 2

    def test_no_data(self):
        """
        Test the endpoint functions when assets have no data
        """
        self.client.login(username='anotheruser', password='anotheruser')
        url = reverse(self._get_endpoint('asset-usage-list'))
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['results'] == []

    def test_no_deployment(self):
        """
        Test the endpoint does not throw a 500 error if an asset is not deployed
        """
        Asset.objects.create(
            content={
                'survey': [
                    {'type': 'audio', 'label': 'q1', 'required': 'false',
                     '$kuid': 'abcd'},
                    {'type': 'file', 'label': 'q2', 'required': 'false', '$kuid': 'efgh'},
                ]
            },
            owner=self.anotheruser,
            asset_type='survey',
        )
        self.client.login(username='anotheruser', password='anotheruser')
        url = reverse(self._get_endpoint('asset-usage-list'))
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK
