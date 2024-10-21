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

    fixtures = ['test_data']

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
        # create an initial deployment
        self.asset.deploy(backend='mock', active=True)
        patch_data = {'active': True, 'version_id': self.asset.version_id}

        def verify_metadata(log_metadata):
            self.assertEqual(
                log_metadata['latest_deployed_version_uid'],
                self.asset.latest_version.uid,
            )

        self._base_endpoint_test(
            patch=True,
            url_name=self.deployment_url,
            request_data=patch_data,
            expected_action=AuditAction.REDEPLOY,
            verify_additional_metadata=verify_metadata,
        )

    def test_change_project_content_creates_log(self):
        request_data = {
            'content': {
                'survey': [
                    {
                        'type': 'text',
                        'label': 'new question',
                        'name': 'new_question',
                        'kuid': 'hijk',
                    }
                ]
            }
        }
        self._base_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data=request_data,
            expected_action=AuditAction.UPDATE_FORM,
            verify_additional_metadata=lambda x: None,
        )

    def test_enable_sharing_creates_log(self):
        request_data = {'data_sharing': {'enabled': True, 'fields': ['q1']}}

        def verify_metadata(log_metadata):
            self.assertListEqual(log_metadata['shared_fields']['added'], ['q1'])

        self._base_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data=request_data,
            expected_action=AuditAction.ENABLE_SHARING,
            verify_additional_metadata=verify_metadata,
        )

    def test_disable_sharing_creates_log(self):
        # turn sharing on
        self.asset.data_sharing = {'enabled': True, 'fields': ['q1', 'q2']}
        self.asset.save()
        request_data = {'data_sharing': {'enabled': False, 'fields': []}}
        self._base_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data=request_data,
            expected_action=AuditAction.DISABLE_SHARING,
            verify_additional_metadata=lambda x: None,
        )

    def test_modify_shared_fields_creates_log(self):
        self.asset.content = {
            'survey': [
                {'type': 'text', 'label': 'fixture q1', 'name': 'q1', 'kuid': 'abc'},
                {'type': 'text', 'label': 'fixture q2', 'name': 'q2', 'kuid': 'def'},
                {'type': 'text', 'label': 'fixture q3', 'name': 'q3', 'kuid': 'def'},
            ]
        }
        # turn sharing on
        self.asset.data_sharing = {'enabled': True, 'fields': ['q1', 'q2']}
        self.asset.save()
        request_data = {'data_sharing': {'enabled': True, 'fields': ['q2', 'q3']}}

        def verify_metadata(log_metadata):
            self.assertListEqual(log_metadata['shared_fields']['added'], ['q3'])
            self.assertListEqual(log_metadata['shared_fields']['removed'], ['q1'])

        self._base_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data=request_data,
            expected_action=AuditAction.MODIFY_SHARING,
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
