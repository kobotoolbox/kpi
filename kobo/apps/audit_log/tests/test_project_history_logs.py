import copy

from django.test import override_settings
from django.urls import reverse

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import ProjectHistoryLog
from kobo.apps.audit_log.tests.test_models import BaseAuditLogTestCase
from kobo.apps.kobo_auth.shortcuts import User
from kpi.models import Asset


@override_settings(DEFAULT_DEPLOYMENT_BACKEND='mock')
class TestProjectHistoryLogs(BaseAuditLogTestCase):

    fixtures = ['test_data', 'asset_with_settings_and_qa']

    def setUp(self):
        super().setUp()
        # log in as admin
        user = User.objects.get(username='admin')
        self.client.force_login(user=user)
        # use the same asset
        asset = Asset.objects.get(pk=3)
        # save to create a version
        asset.save()
        self.asset = asset
        self.detail_url = 'api_v2:asset-detail'
        self.deployment_url = 'api_v2:asset-deployment'

    def _check_common_metadata(self, metadata_dict):
        self.assertEqual(metadata_dict['asset_uid'], self.asset.uid)
        self.assertEqual(metadata_dict['ip_address'], '127.0.0.1')
        self.assertEqual(metadata_dict['source'], 'source')
        self.assertEqual(
            metadata_dict['latest_version_uid'], self.asset.latest_version.uid
        )

    def _base_endpoint_test(
        self, patch, url_name, request_data, expected_action, verify_additional_metadata
    ):
        # requests are either patches or posts
        request_method = self.client.patch if patch else self.client.post
        # hit the endpoint with the correct data
        request_method(
            reverse(url_name, kwargs={'uid': self.asset.uid}),
            data=request_data,
            format='json',
        )
        # make sure a log was created
        logs = ProjectHistoryLog.objects.filter(metadata__asset_uid=self.asset.uid)
        self.assertEqual(logs.count(), 1)
        log = logs.first()
        # check the log has the expected fields and metadata
        self._check_common_metadata(log.metadata)
        self.assertEqual(log.object_id, self.asset.id)
        self.assertEqual(log.action, expected_action)
        verify_additional_metadata(log.metadata)

    def test_first_time_deployment_creates_log(self):
        post_data = {
            'active': True,
            'backend': 'mock',
        }

        def verify_metadata(log_metadata):
            self.assertEqual(
                log_metadata['latest_deployed_version_uid'],
                self.asset.latest_version.uid,
            )

        self._base_endpoint_test(
            patch=False,
            url_name=self.deployment_url,
            request_data=post_data,
            expected_action=AuditAction.DEPLOY,
            verify_additional_metadata=verify_metadata,
        )

    def test_redeployment_creates_log(self):
        # first time deploy
        self.asset.deploy(backend='mock', active=True)
        request_data = {
            'active': True,
            'backend': 'mock',
        }

        def verify_metadata(log_metadata):
            self.assertEqual(
                log_metadata['latest_deployed_version_uid'],
                self.asset.latest_version.uid,
            )

        self._base_endpoint_test(
            patch=True,
            url_name=self.deployment_url,
            request_data=request_data,
            expected_action=AuditAction.REDEPLOY,
            verify_additional_metadata=verify_metadata,
        )

    def test_archive_creates_log(self):
        # can only archive deployed asset
        self.asset.deploy(backend='mock', active=True)
        request_data = {
            'active': False,
        }
        self._base_endpoint_test(
            patch=True,
            url_name=self.deployment_url,
            request_data=request_data,
            expected_action=AuditAction.ARCHIVE,
            verify_additional_metadata=lambda x: None,
        )
        # do it again (archive an already-archived asset)
        self.client.patch(
            reverse('api_v2:asset-deployment', kwargs={'uid': self.asset.uid}),
            data=request_data,
            format='json',
        )
        unarchived_logs = ProjectHistoryLog.objects.filter(
            object_id=self.asset.id, action=AuditAction.ARCHIVE
        )
        # we should log the attempt even if it didn't technically do anything
        self.assertEqual(unarchived_logs.count(), 2)

    def test_unarchive_creates_log(self):
        # can only unarchive deployed asset
        self.asset.deploy(backend='mock', active=False)
        request_data = {
            'active': True,
        }
        self._base_endpoint_test(
            patch=True,
            url_name=self.deployment_url,
            request_data=request_data,
            expected_action=AuditAction.UNARCHIVE,
            verify_additional_metadata=lambda x: None,
        )
        # do it again (unarchive an already-unarchived asset)
        self.client.patch(
            reverse('api_v2:asset-deployment', kwargs={'uid': self.asset.uid}),
            data=request_data,
            format='json',
        )
        unarchived_logs = ProjectHistoryLog.objects.filter(
            object_id=self.asset.id, action=AuditAction.UNARCHIVE
        )
        # we should log the attempt even if it didn't technically do anything
        self.assertEqual(unarchived_logs.count(), 2)

    def test_failed_requests_does_not_create_log(self):
        # attempt to PATCH on an un-deployed asset
        request_data = {
            'active': True,
        }
        self.client.patch(
            reverse('api_v2:asset-deployment', kwargs={'uid': self.asset.uid}),
            data=request_data,
            format='json',
        )
        # deploy asset
        self.asset.deploy(backend='mock', active=True)
        # attempt to POST to a deployed asset
        self.client.post(
            reverse('api_v2:asset-deployment', kwargs={'uid': self.asset.uid}),
            data=request_data,
            format='json',
        )
        # no logs should be created
        self.assertEqual(ProjectHistoryLog.objects.count(), 0)


    def test_change_project_name_creates_log(self):
        old_name = self.asset.name

        def verify_metadata(log_metadata):
            self.assertEqual(log_metadata['name']['new'], 'new_name')
            self.assertEqual(log_metadata['name']['old'], old_name)

        self._base_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data={'name': 'new_name'},
            verify_additional_metadata=verify_metadata,
            expected_action=AuditAction.UPDATE_NAME,
        )

    def test_change_project_settings_creates_log(self):
        old_settings = copy.deepcopy(self.asset.settings)
        patch_data = {
            'settings': {
                'sector': {'label': 'Health', 'value': 'Health'},
                'country': [{'label': 'Albania', 'value': 'ALB'}],
                'operational_purpose': 'New operational purpose',
                'collects_pii': True,
                'description': 'New description',
            }
        }

        def verify_metadata(log_metadata):
            # check non-list settings just store old and new information
            settings_dict = log_metadata['settings']
            self.assertDictEqual(settings_dict['sector']['old'], old_settings['sector'])
            self.assertDictEqual(
                settings_dict['sector']['new'],
                {'label': 'Health', 'value': 'Health'},
            )
            self.assertEqual(
                settings_dict['operational_purpose']['old'],
                old_settings['operational_purpose'],
            )
            self.assertEqual(
                settings_dict['operational_purpose']['new'],
                'New operational purpose',
            )
            self.assertEqual(
                settings_dict['collects_pii']['old'], old_settings['collects_pii']
            )
            self.assertEqual(settings_dict['collects_pii']['new'], True)
            self.assertEqual(
                settings_dict['description']['old'], old_settings['description']
            )
            self.assertEqual(settings_dict['description']['new'], 'New description')
            # check list settings store added and removed fields
            self.assertListEqual(
                settings_dict['country']['added'],
                [{'label': 'Albania', 'value': 'ALB'}],
            )
            self.assertListEqual(
                settings_dict['country']['removed'],
                [{'label': 'United States', 'value': 'USA'}],
            )

        self._base_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data=patch_data,
            verify_additional_metadata=verify_metadata,
            expected_action=AuditAction.UPDATE_SETTINGS,
        )

    def test_unchanged_settings_not_recorded_on_log(self):
        patch_data = {
            'settings': {
                'sector': self.asset.settings['sector'],
                'country': self.asset.settings['country'],
                'operational_purpose': self.asset.settings['operational_purpose'],
                'collects_pii': self.asset.settings['collects_pii'],
                'description': 'New description',
            }
        }

        def verify_metadata(log_metadata):
            self.assertNotIn('sector', log_metadata.keys())
            self.assertNotIn('country', log_metadata.keys())
            self.assertNotIn('operational_purpose', log_metadata.keys())
            self.assertNotIn('collects_pii', log_metadata.keys())

        self._base_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data=patch_data,
            verify_additional_metadata=verify_metadata,
            expected_action=AuditAction.UPDATE_SETTINGS,
        )
