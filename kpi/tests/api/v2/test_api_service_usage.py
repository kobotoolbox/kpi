# coding: utf-8
import os.path
import uuid

from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import (
    XForm,
    DailyXFormSubmissionCounter,
)
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

    xform = None
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
        self.submission_list_url = self.asset.deployment.submission_list_url
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

        self.asset.deployment.mock_submissions(submissions, flush_db=False)
        self.update_xform_counters(self.asset, submissions=count)

    def update_xform_counters(self, asset: Asset, submissions: int = 0):
        """
        Create/update the daily submission counter and the shadow xform we use to query it
        """
        today = timezone.now()
        if self.xform:
            self.xform.attachment_storage_bytes += (
                self.expected_file_size() * submissions
            )
            self.xform.save()
        else:
            xform_xml = (
                f'<?xml version="1.0" encoding="utf-8"?>'
                f'<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:ev="http://www.w3.org/2001/xml-events" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa" xmlns:odk="http://www.opendatakit.org/xforms" xmlns:orx="http://openrosa.org/xforms" xmlns:xsd="http://www.w3.org/2001/XMLSchema">'
                f'<h:head>'
                f'   <h:title>XForm test</h:title>'
                f'   <model odk:xforms-version="1.0.0">'
                f'       <instance>'
                f'           <{asset.uid} id="{asset.uid}" />'
                f'       </instance>'
                f'   </model>'
                f'</h:head>'
                f'<h:body>'
                f'</h:body>'
                f'</h:html>'
            )

            self.xform = XForm.objects.create(
                attachment_storage_bytes=(
                    self.expected_file_size() * submissions
                ),
                kpi_asset_uid=asset.uid,
                date_created=today,
                date_modified=today,
                user_id=asset.owner_id,
                xml=xform_xml,
                json={}
            )
            self.xform.save()

        if self.counter:
            self.counter.counter += submissions
            self.counter.save()
        else:
            self.counter = (
                DailyXFormSubmissionCounter.objects.create(
                    date=today.date(),
                    counter=submissions,
                    xform=self.xform,
                    user_id=asset.owner_id,
                )
            )
            self.counter.save()

    def expected_file_size(self):
        """
        Calculate the expected combined file size for the test audio clip and image
        """
        return os.path.getsize(
            settings.BASE_DIR + '/kpi/tests/audio_conversion_test_clip.3gp'
        ) + os.path.getsize(
            settings.BASE_DIR + '/kpi/tests/audio_conversion_test_image.jpg'
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
        self.asset.pending_delete = True
        self.asset.save(
            update_fields=['pending_delete'],
            create_version=False,
            adjust_content=False,
        )
        self.xform.pending_delete = True
        self.xform.save(update_fields=['pending_delete'])

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
