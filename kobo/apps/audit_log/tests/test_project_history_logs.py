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
