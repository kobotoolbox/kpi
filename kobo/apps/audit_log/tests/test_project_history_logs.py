import copy
import unittest

from kobo.apps.audit_log.models import ProjectHistoryLog
from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.tests.test_models import BaseAuditLogTestCase
from kpi.deployment_backends.mock_backend import MockDeploymentBackend
from kpi.models import Asset
from kpi.tests.kpi_test_case import KpiTestCase
from kobo.apps.kobo_auth.shortcuts import User
from django.urls import reverse
from django.test import override_settings


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

    def _check_common_metadata(self, metadata_dict, asset):
        self.assertEqual(metadata_dict['asset_uid'], asset.uid)
        self.assertEqual(metadata_dict['ip_address'], '127.0.0.1')
        self.assertEqual(metadata_dict['source'], 'source')
        self.assertEqual(metadata_dict['latest_version_uid'], self.asset.latest_version.uid)

    def test_change_project_name_creates_log(self):
        old_name = self.asset.name
        self.client.patch(
            reverse('api_v2:asset-detail', kwargs={'uid': self.asset.uid}),
            data={'name': 'new_name'}
        )
        logs = ProjectHistoryLog.objects.filter(metadata__asset_uid=self.asset.uid)
        self.assertEqual(logs.count(), 1)
        log = logs.first()
        self.assertEqual(log.metadata['name']['new'], 'new_name')
        self.assertEqual(log.metadata['name']['old'], old_name)
        self.assertEqual(log.action, AuditAction.UPDATE_NAME)
        self.assertEqual(log.object_id, self.asset.id)

    def test_change_project_settings_creates_log(self):
        old_settings = copy.deepcopy(self.asset.settings)
        user = User.objects.get(username='admin')
        self.client.force_login(user=user)
        patch_data = {'settings': {
            'sector': {'label': 'Health', 'value': 'Health'},
            'country': [{'label': 'Albania', 'value': 'ALB'}],
            'operational_purpose': 'New operational purpose',
            'collects_pii': True,
            'description': 'New description',
        }}
        self.client.patch(
            reverse('api_v2:asset-detail', kwargs={'uid': self.asset.uid}),
            data = patch_data,
            format='json',
        )
        logs = ProjectHistoryLog.objects.filter(metadata__asset_uid=self.asset.uid)
        self.assertEqual(logs.count(), 1)
        log = logs.first()
        self.assertEqual(log.object_id, self.asset.id)
        log_settings_metadata = log.metadata['settings']
        # check non-list settings just store old and new information
        self.assertDictEqual(log_settings_metadata['sector']['old'], old_settings['sector'])
        self.assertDictEqual(log_settings_metadata['sector']['new'], {'label': 'Health', 'value': 'Health'})
        self.assertEqual(log_settings_metadata['operational_purpose']['old'], old_settings['operational_purpose'])
        self.assertEqual(log_settings_metadata['operational_purpose']['new'], 'New operational purpose')
        self.assertEqual(log_settings_metadata['collects_pii']['old'], old_settings['collects_pii'])
        self.assertEqual(log_settings_metadata['collects_pii']['new'], True)
        self.assertEqual(log_settings_metadata['description']['old'], old_settings['description'])
        self.assertEqual(log_settings_metadata['description']['new'], 'New description')
        # check list settings store added and removed fields
        self.assertListEqual(log_settings_metadata['country']['added'], [{'label': 'Albania', 'value': 'ALB'}])
        self.assertListEqual(log_settings_metadata['country']['removed'], [{'label': 'United States', 'value': 'USA'}])

    def test_unchanged_settings_not_recorded_on_log(self):
        patch_data = {'settings': {
            'sector': self.asset.settings['sector'],
            'country': self.asset.settings['country'],
            'operational_purpose': self.asset.settings['operational_purpose'],
            'collects_pii': self.asset.settings['collects_pii'],
            'description': 'New description',
        }}
        self.client.patch(
            reverse('api_v2:asset-detail', kwargs={'uid': self.asset.uid}),
            data = patch_data,
            format='json',
        )
        logs = ProjectHistoryLog.objects.filter(metadata__asset_uid=self.asset.uid)
        self.assertEqual(logs.count(), 1)
        log = logs.first()
        log_settings_metadata = log.metadata['settings']
        self.assertNotIn('sector', log_settings_metadata.keys())
        self.assertNotIn('country', log_settings_metadata.keys())
        self.assertNotIn('operational_purpose', log_settings_metadata.keys())
        self.assertNotIn('collects_pii', log_settings_metadata.keys())

    def test_first_time_deployment_creates_log(self):
        post_data = {
            'active': True,
            'backend': 'mock',
        }
        self.client.post(
            reverse('api_v2:asset-deployment', kwargs={'uid': self.asset.uid}),
            data = post_data,
            format='json',
        )
        logs = ProjectHistoryLog.objects.filter(metadata__asset_uid=self.asset.uid)
        self.assertEqual(logs.count(), 1)
        log = logs.first()
        self.assertEqual(log.object_id, self.asset.id)
        self.assertEqual(log.metadata['latest_deployed_version_uid'], self.asset.latest_version.uid)
        self.assertEqual(log.action, AuditAction.DEPLOY)

    def test_redeployment_creates_log(self):
        self.asset.deploy(backend='mock', active=True)
        patch_data = {
            'active': True,
            'version_id': self.asset.version_id
        }
        self.client.patch(
            reverse('api_v2:asset-deployment', kwargs={'uid': self.asset.uid}),
            data = patch_data,
            format='json',
        )
        logs = ProjectHistoryLog.objects.filter(metadata__asset_uid=self.asset.uid)
        self.assertEqual(logs.count(), 1)
        log = logs.first()
        self.assertEqual(log.object_id, self.asset.id)
        self.assertEqual(log.metadata['latest_deployed_version_uid'], self.asset.latest_version.uid)
        self.assertEqual(log.action, AuditAction.REDEPLOY)

    def test_change_project_content_creates_log(self):
        new_content = {
            'survey': [
                {'type': 'text', 'label': 'new question', 'name': 'new_question', 'kuid': 'hijk'}
            ]
        }
        self.client.patch(
            reverse('api_v2:asset-detail', kwargs={'uid': self.asset.uid}),
            data={'content': new_content},
            format='json',
        )
        logs = ProjectHistoryLog.objects.filter(metadata__asset_uid=self.asset.uid)
        self.assertEqual(logs.count(), 1)
        log = logs.first()
        self._check_common_metadata(log.metadata, self.asset)
        self.assertEqual(log.action, AuditAction.UPDATE_FORM)

    def test_enable_sharing_creates_log(self):
        patch_data = {
            'data_sharing': {
                'enabled': True,
                'fields': ['q1']
            }
        }
        self.client.patch(
            reverse('api_v2:asset-detail', kwargs={'uid': self.asset.uid}),
            data=patch_data,
            format='json',
        )
        logs = ProjectHistoryLog.objects.filter(metadata__asset_uid=self.asset.uid)
        self.assertEqual(logs.count(), 1)
        log = logs.first()
        self._check_common_metadata(log.metadata, self.asset)
        self.assertEqual(log.action, AuditAction.ENABLE_SHARING)
        self.assertListEqual(log.metadata['shared_fields']['added'], ['q1'])

    def test_disable_sharing_creates_log(self):
        # turn sharing on
        self.asset.data_sharing = {
            'enabled': True,
            'fields': ['q1', 'q2']
        }
        self.asset.save()
        patch = {
            'data_sharing': {
                'enabled': False,
                'fields': []
            }
        }
        self.client.patch(
            reverse('api_v2:asset-detail', kwargs={'uid': self.asset.uid}),
            data=patch,
            format='json',
        )
        logs = ProjectHistoryLog.objects.filter(metadata__asset_uid=self.asset.uid)
        self.assertEqual(logs.count(), 1)
        log = logs.first()
        self._check_common_metadata(log.metadata, self.asset)
        self.assertEqual(log.action, AuditAction.DISABLE_SHARING)

    def test_modify_shared_fields_creates_log(self):
        self.asset.content = { 'survey':[
            {"type": "text", "label": "fixture q1", "name": "q1", "kuid": "abc"},
            {"type": "text", "label": "fixture q2", "name": "q2", "kuid": "def"},
            {"type": "text", "label": "fixture q3", "name": "q3", "kuid": "def"}
        ]}
        # turn sharing on
        self.asset.data_sharing = {
            'enabled': True,
            'fields': ['q1', 'q2']
        }
        self.asset.save()
        post_data = {
            'data_sharing': {
                'enabled': True,
                'fields': ['q2', 'q3']
            }
        }
        self.client.patch(
            reverse('api_v2:asset-detail', kwargs={'uid': self.asset.uid}),
            data=post_data,
            format='json',
        )
        logs = ProjectHistoryLog.objects.filter(metadata__asset_uid=self.asset.uid)
        self.assertEqual(logs.count(), 1)
        log = logs.first()
        self._check_common_metadata(log.metadata, self.asset)
        self.assertEqual(log.action, AuditAction.MODIFY_SHARING)
        self.assertListEqual(log.metadata['shared_fields']['added'], ['q3'])
        self.assertListEqual(log.metadata['shared_fields']['removed'], ['q1'])

    def test_archive_creates_log(self):
        # can only archive deployed asset
        self.asset.deploy(backend='mock', active=True)
        post_data = {
            'active': False,
        }
        self.client.patch(
            reverse('api_v2:asset-deployment', kwargs={'uid': self.asset.uid}),
            data = post_data,
            format='json',
        )
        logs = ProjectHistoryLog.objects.filter(metadata__asset_uid=self.asset.uid)
        self.assertEqual(logs.count(), 1)
        log = logs.first()
        self.assertEqual(log.object_id, self.asset.id)
        self.assertEqual(log.action, AuditAction.ARCHIVE)

    def test_unarchive_creates_log(self):
        # can only unarchive deployed asset
        self.asset.deploy(backend='mock', active=False)
        post_data = {
            'active': True,
        }
        self.client.patch(
            reverse('api_v2:asset-deployment', kwargs={'uid': self.asset.uid}),
            data = post_data,
            format='json',
        )
        logs = ProjectHistoryLog.objects.filter(metadata__asset_uid=self.asset.uid)
        self.assertEqual(logs.count(), 1)
        log = logs.first()
        self.assertEqual(log.object_id, self.asset.id)
        self.assertEqual(log.action, AuditAction.UNARCHIVE)

