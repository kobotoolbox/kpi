import copy

from django.test import override_settings
from django.urls import reverse

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import ADDED, NEW, OLD, REMOVED, ProjectHistoryLog
from kobo.apps.audit_log.tests.test_models import BaseAuditLogTestCase
from kobo.apps.kobo_auth.shortcuts import User
from kpi.models import Asset
from kpi.models.asset import AssetSetting


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

    def _base_endpoint_test(self, patch, url_name, request_data, expected_action):
        # requests are either patches or posts
        request_method = self.client.patch if patch else self.client.post
        # hit the endpoint with the correct data
        request_method(
            reverse(url_name, kwargs={'uid': self.asset.uid}),
            data=request_data,
            format='json',
        )
        self.asset.refresh_from_db()

        # make sure a log was created
        logs = ProjectHistoryLog.objects.filter(metadata__asset_uid=self.asset.uid)
        self.assertEqual(logs.count(), 1)
        log = logs.first()
        # check the log has the expected fields and metadata
        self._check_common_metadata(log.metadata)
        self.assertEqual(log.object_id, self.asset.id)
        self.assertEqual(log.action, expected_action)
        return log.metadata

    def test_first_time_deployment_creates_log(self):
        post_data = {
            'active': True,
            'backend': 'mock',
        }
        log_metadata = self._base_endpoint_test(
            patch=False,
            url_name=self.deployment_url,
            request_data=post_data,
            expected_action=AuditAction.DEPLOY,
        )

        self.assertEqual(
            log_metadata['latest_deployed_version_uid'],
            self.asset.latest_version.uid,
        )

    def test_redeployment_creates_log(self):
        # first time deploy
        self.asset.deploy(backend='mock', active=True)
        request_data = {
            'active': True,
            'backend': 'mock',
        }
        log_metadata = self._base_endpoint_test(
            patch=True,
            url_name=self.deployment_url,
            request_data=request_data,
            expected_action=AuditAction.REDEPLOY,
        )

        self.assertEqual(
            log_metadata['latest_deployed_version_uid'],
            self.asset.latest_version.uid,
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
        )
        # do it again (archive an already-archived asset)
        self.client.patch(
            reverse('api_v2:asset-deployment', kwargs={'uid': self.asset.uid}),
            data=request_data,
            format='json',
        )
        archived_logs = ProjectHistoryLog.objects.filter(
            object_id=self.asset.id, action=AuditAction.ARCHIVE
        )
        # we should log the attempt even if it didn't technically do anything
        self.assertEqual(archived_logs.count(), 2)

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

        log_metadata = self._base_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data={'name': 'new_name'},
            expected_action=AuditAction.UPDATE_NAME,
        )

        self.assertEqual(log_metadata['name'][NEW], 'new_name')
        self.assertEqual(log_metadata['name'][OLD], old_name)

    def test_change_standard_project_settings_creates_log(self):
        old_settings = copy.deepcopy(self.asset.settings)
        # both country and description are in Asset.STANDARDIZED_SETTINGS
        patch_data = {
            'settings': {
                'country': [{'label': 'Albania', 'value': 'ALB'}],
                'description': 'New description',
            }
        }

        log_metadata = self._base_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data=patch_data,
            expected_action=AuditAction.UPDATE_SETTINGS,
        )

        # check non-list settings just store old and new information
        settings_dict = log_metadata['settings']
        self.assertEqual(
            settings_dict['description'][OLD], old_settings['description']
        )
        self.assertEqual(settings_dict['description'][NEW], 'New description')
        # check list settings store added and removed fields
        self.assertListEqual(
            settings_dict['country'][ADDED],
            [{'label': 'Albania', 'value': 'ALB'}],
        )
        self.assertListEqual(
            settings_dict['country'][REMOVED],
            [{'label': 'United States', 'value': 'USA'}],
        )
        # check default settings not recorded if not included in request
        for setting in Asset.STANDARDIZED_SETTINGS:
            # country codes are updated automatically when country is updated
            if setting not in ['country', 'settings', 'country_codes']:
                self.assertNotIn(setting, log_metadata)

    def test_unchanged_settings_not_recorded_on_log(self):
        """
        Check settings not included on log if in the request but did not change
        """
        patch_data = {
            'settings': {
                'sector': self.asset.settings['sector'],
                'country': self.asset.settings['country'],
                # only change description
                'description': 'New description',
            }
        }
        log_metadata = self._base_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data=patch_data,
            expected_action=AuditAction.UPDATE_SETTINGS,
        )

        self.assertNotIn('sector', log_metadata)
        self.assertNotIn('country', log_metadata)
        self.assertNotIn('operational_purpose', log_metadata)
        self.assertNotIn('collects_pii', log_metadata)

    def test_no_log_if_settings_unchanged(self):
        # fill request with only existing values
        patch_data = {
            'settings': {
                'sector': self.asset.settings['sector'],
                'country': self.asset.settings['country'],
                'description': self.asset.settings['description'],
            }
        }

        self.client.patch(
            reverse('api_v2:asset-detail', kwargs={'uid': self.asset.uid}),
            data=patch_data,
            format='json',
        )

        self.assertEqual(ProjectHistoryLog.objects.count(), 0)

    def test_nullify_settings_creates_log(self):
        old_settings = copy.deepcopy(self.asset.settings)

        log_metadata = self._base_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data={'settings': {}},
            expected_action=AuditAction.UPDATE_SETTINGS,
        )
        for setting, old_value in old_settings.items():
            if setting in Asset.STANDARDIZED_SETTINGS:
                # if the setting is one of the standard ones, the new value after
                # nulling it out will be whatever is configured as the default
                setting_configs: AssetSetting = Asset.STANDARDIZED_SETTINGS[setting]
                new_value = (
                    setting_configs.default_val(self.asset)
                    if callable(setting_configs.default_val)
                    else setting_configs.default_val
                )
            else:
                new_value = None

            if isinstance(new_value, list) and isinstance(old_value, list):
                removed_values = [val for val in old_value if val not in new_value]
                added_values = [val for val in new_value if val not in old_value]
                self.assertListEqual(
                    log_metadata['settings'][setting][ADDED], added_values
                )
                self.assertListEqual(
                    log_metadata['settings'][setting][REMOVED], removed_values
                )
            else:
                self.assertEqual(
                    log_metadata['settings'][setting][NEW], new_value
                )
                self.assertEqual(
                    log_metadata['settings'][setting][OLD], old_value
                )

    def test_add_new_settings_creates_log(self):
        log_metadata = self._base_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            # set a setting not in Asset.STANDARDIZED_SETTINGS
            request_data={'settings': {'new_setting': 'new_value'}},
            expected_action=AuditAction.UPDATE_SETTINGS,
        )

        self.assertEqual(log_metadata['settings']['new_setting'][NEW], 'new_value')
        self.assertEqual(log_metadata['settings']['new_setting'][OLD], None)

    def test_enable_sharing_creates_log(self):
        log_metadata = self._base_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data={'data_sharing': {'enabled': True, 'fields': []}},
            expected_action=AuditAction.ENABLE_SHARING,
        )
        self.assertEqual(log_metadata['shared_fields'][ADDED], [])


    def test_truthy_field_creates_sharing_enabled_log(self):
        def verify_metadata(log_metadata):
            self.assertEqual(log_metadata['shared_fields'][ADDED], [])

        self._base_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data={'data_sharing': {'enabled': 'truthy'}},
            verify_additional_metadata=verify_metadata,
            expected_action=AuditAction.ENABLE_SHARING,
        )

    def test_disable_sharing_creates_log(self):
        self.asset.data_sharing = {
            'enabled': True,
            'fields': [],
        }
        self.asset.save()

        self._base_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data={'data_sharing': {'enabled': False}},
            expected_action=AuditAction.DISABLE_SHARING,
        )

    def test_nullify_sharing_creates_sharing_disabled_log(self):
        self.asset.data_sharing = {
            'enabled': True,
            'fields': [],
        }
        self.asset.save()

        self._base_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data={'data_sharing': {}},
            expected_action=AuditAction.DISABLE_SHARING,
        )

    def test_falsy_field_creates_sharing_disabled_log(self):
        self.asset.data_sharing = {
            'enabled': True,
            'fields': [],
        }
        self.asset.save()

        self._base_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data={'data_sharing': {'enabled': 0}},
            verify_additional_metadata=lambda x: None,
            expected_action=AuditAction.DISABLE_SHARING,
        )

    def test_modify_sharing_creates_log(self):
        self.asset.data_sharing = {
            'enabled': True,
            'fields': ['q1'],
        }
        self.asset.save()
        log_metadata = self._base_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data={'data_sharing': {'enabled': True, 'fields': ['q2']}},
            expected_action=AuditAction.MODIFY_SHARING,
        )
        self.assertEqual(log_metadata['shared_fields'][ADDED], ['q2'])
        self.assertEqual(log_metadata['shared_fields'][REMOVED], ['q1'])
