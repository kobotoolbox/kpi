# coding: utf-8
import os.path
import uuid

from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.contrib.auth.models import User
from django.db import connection
from django.urls import reverse
from django.utils import timezone
from model_bakery import baker
from rest_framework import status

from kobo.apps.organizations.models import Organization
from kobo.apps.trackers.models import NLPUsageCounter
from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatXForm,
    ReadOnlyKobocatDailyXFormSubmissionCounter,
)
from kpi.models import Asset
from kpi.tests.base_test_case import BaseAssetTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class ServiceUsageAPITestCase(BaseAssetTestCase):
    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    unmanaged_models = [
        ReadOnlyKobocatDailyXFormSubmissionCounter,
        KobocatXForm,
    ]
    xform = None
    counter = None

    def setUp(self) -> None:
        super().setUp()
        self.client.login(username='anotheruser', password='anotheruser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.someuser = User.objects.get(username='someuser')
        with connection.schema_editor() as schema_editor:
            for unmanaged_model in self.unmanaged_models:
                schema_editor.create_model(unmanaged_model)

    def __create_asset(self, user=None):
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

    def __add_submission(self):
        """
        Adds ONE submission to an asset
        """
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
            '_submitted_by': 'anotheruser',
        }
        submissions.append(submission)
        self.asset.deployment.mock_submissions(submissions, flush_db=False)
        self.__update_xform_counters(self.asset, submissions=1)

    def __add_nlp_trackers(self):
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

    def __add_submissions(self):
        """
        Adds TWO submissions to an asset
        """
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
            '_submitted_by': 'anotheruser',
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
            '_submitted_by': 'anotheruser',
        }

        submissions.append(submission1)
        submissions.append(submission2)

        self.asset.deployment.mock_submissions(submissions, flush_db=False)
        self.__update_xform_counters(self.asset, submissions=2)

    def __update_xform_counters(self, asset: Asset, submissions: int = 0):
        """
        Create/update the daily submission counter and the shadow xform we use to query it
        """
        today = timezone.now()
        if self.xform:
            self.xform.attachment_storage_bytes += (
                self.__expected_file_size() * submissions
            )
            self.xform.save()
        else:
            self.xform = KobocatXForm.objects.create(
                attachment_storage_bytes=(
                    self.__expected_file_size() * submissions
                ),
                kpi_asset_uid=asset.uid,
                date_created=today,
                date_modified=today,
                user_id=asset.owner_id,
            )
            self.xform.save()

        if self.counter:
            self.counter.counter += submissions
            self.counter.save()
        else:
            self.counter = (
                ReadOnlyKobocatDailyXFormSubmissionCounter.objects.create(
                    date=today.date(),
                    counter=submissions,
                    xform=self.xform,
                    user_id=asset.owner_id,
                )
            )
            print(vars(self.counter))
            self.counter.save()

    def __expected_file_size(self):
        """
        Calculate the expected combined file size for the test audio clip and image
        """
        return os.path.getsize(
            settings.BASE_DIR + '/kpi/tests/audio_conversion_test_clip.mp4'
        ) + os.path.getsize(
            settings.BASE_DIR + '/kpi/tests/audio_conversion_test_image.jpg'
        )

    def test_anonymous_user(self):
        """
        Test that the endpoint is forbidden to anonymous user
        """
        self.client.logout()
        url = reverse(self._get_endpoint('service-usage-list'))
        response = self.client.get(url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_check_api_response(self):
        """
        Test the endpoint aggregates all data correctly
        """
        self.__create_asset()
        self.__add_nlp_trackers()
        self.__add_submission()

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
            response.data['total_storage_bytes'] == self.__expected_file_size()
        )

    def test_multiple_forms(self):
        """
        Test that the endpoint functions with multiple assets and the data is
        aggregated properly with
        """
        self.__create_asset()
        self.__add_submission()

        self.__create_asset()
        self.__add_submissions()

        url = reverse(self._get_endpoint('service-usage-list'))
        response = self.client.get(url)
        assert response.data['total_submission_count']['current_month'] == 3
        assert response.data['total_submission_count']['all_time'] == 3
        assert response.data['total_storage_bytes'] == (
            self.__expected_file_size() * 3
        )

    def test_usage_for_organization(self):
        """
        Test that the endpoint aggregates usage for each user in the organization
        when viewing /service_usage/{organization_id}/
        """
        self.client.login(username='anotheruser', password='anotheruser')
        organization = baker.make(Organization, id='orgAKWMFskafsngf', name='test organization')
        organization.add_user(self.anotheruser, is_admin=True)
        self.__create_asset()
        self.__add_submission()

        url = reverse(self._get_endpoint('service-usage-list'))
        detail_url = f'{url}{organization.id}/'
        response = self.client.get(detail_url)
        assert response.data['total_submission_count']['current_month'] == 1
        assert response.data['total_submission_count']['all_time'] == 1
        assert response.data['total_storage_bytes'] == (
            self.__expected_file_size()
        )

        organization.add_user(self.someuser, is_admin=False)
        self.__create_asset(self.someuser)
        self.__add_submission()
        response = self.client.get(detail_url)
        assert response.data['total_submission_count']['current_month'] == 2
        assert response.data['total_submission_count']['all_time'] == 2
        assert response.data['total_storage_bytes'] == (
            self.__expected_file_size() * 2
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
