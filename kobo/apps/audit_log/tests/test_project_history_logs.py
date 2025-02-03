import base64
import copy
import json
import uuid
from unittest.mock import patch
from xml.etree import ElementTree as ET

import jsonschema.exceptions
import responses
from ddt import data, ddt, unpack
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from pymongo.errors import PyMongoError
from rest_framework.response import Response
from rest_framework.reverse import reverse as drf_reverse

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import ProjectHistoryLog
from kobo.apps.audit_log.tests.test_models import BaseAuditLogTestCase
from kobo.apps.hook.models import Hook
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.libs.utils.logger_tools import dict2xform
from kpi.constants import (
    ASSET_TYPE_TEMPLATE,
    CLONE_ARG_NAME,
    PERM_ADD_SUBMISSIONS,
    PERM_CHANGE_SUBMISSIONS,
    PERM_MANAGE_ASSET,
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
    PROJECT_HISTORY_LOG_METADATA_FIELD_ADDED,
    PROJECT_HISTORY_LOG_METADATA_FIELD_NEW,
    PROJECT_HISTORY_LOG_METADATA_FIELD_OLD,
    PROJECT_HISTORY_LOG_METADATA_FIELD_REMOVED,
    PROJECT_HISTORY_LOG_PERMISSION_SUBTYPE,
    PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
)
from kpi.models import Asset, AssetFile, ObjectPermission, PairedData
from kpi.models.asset import AssetSetting
from kpi.utils.strings import to_str
from kpi.utils.xml import (
    edit_submission_xml,
    fromstring_preserve_root_xmlns,
    xml_tostring,
)


@ddt
@override_settings(DEFAULT_DEPLOYMENT_BACKEND='mock')
class TestProjectHistoryLogs(BaseAuditLogTestCase):
    """
    Integration tests for flows that create ProjectHistoryLogs
    """

    fixtures = ['test_data', 'asset_with_settings_and_qa']

    def setUp(self):
        super().setUp()
        # log in as admin
        user = User.objects.get(username='adminuser')
        self.user = user
        self.client.force_login(user=user)
        # use the same asset
        asset = Asset.objects.get(pk=3)
        # save to create a version
        asset.save()
        self.asset = asset
        self.detail_url = 'asset-detail'
        self.deployment_url = 'asset-deployment'

    def tearDown(self):
        # clean up mongo
        settings.MONGO_DB.instances.delete_many({})

    def _add_submission(self, username):
        uuid_ = uuid.uuid4()
        # add a submission by <username>
        submission_data = {
            'q1': 'answer',
            'q2': 'answer',
            'meta/instanceID': f'uuid:{uuid_}',
            '_uuid': str(uuid_),
            '_submitted_by': username,
        }
        self.asset.deploy(backend='mock')

        self.asset.deployment.mock_submissions([submission_data])

    def _check_common_metadata(self, metadata_dict, expected_subtype):
        self.assertEqual(metadata_dict['asset_uid'], self.asset.uid)
        self.assertEqual(metadata_dict['ip_address'], '127.0.0.1')
        self.assertEqual(metadata_dict['source'], 'source')
        self.assertEqual(metadata_dict['log_subtype'], expected_subtype)

    def _base_asset_detail_endpoint_test(
        self, patch, url_name, request_data, expected_action, use_v2=True
    ):
        url_name_prefix = 'api_v2:' if use_v2 else ''
        url = reverse(f'{url_name_prefix}{url_name}', kwargs={'uid': self.asset.uid})
        method = self.client.patch if patch else self.client.post
        log_metadata = self._base_project_history_log_test(
            method,
            url,
            request_data,
            expected_action,
            PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
        )
        self.assertEqual(
            log_metadata['latest_version_uid'], self.asset.latest_version.uid
        )
        return log_metadata

    def _base_project_history_log_test(
        self, method, url, request_data, expected_action, expected_subtype
    ):
        # requests are either patches or posts
        # hit the endpoint with the correct data
        method(
            url,
            data=request_data,
            format='json',
        )
        self.asset.refresh_from_db()

        # make sure a log was created
        logs = ProjectHistoryLog.objects.filter(metadata__asset_uid=self.asset.uid)
        self.assertEqual(logs.count(), 1)
        log = logs.first()
        # check the log has the expected fields and metadata
        self.assertEqual(log.object_id, self.asset.id)
        self.assertEqual(log.action, expected_action)
        self._check_common_metadata(log.metadata, expected_subtype)
        return log.metadata

    def _make_bulk_request(self, asset_uids, action) -> Response:
        """
        Make a bulk action request for a list of asset uid's and an action name

        asset_uids: [list_of_uids]
        action: [archive, unarchive, delete, undelete]
        """
        payload = {
            'payload': {
                'asset_uids': asset_uids,
                'action': action,
            }
        }
        url = reverse(self._get_endpoint('asset-bulk'))
        response = self.client.post(url, data=payload, format='json')
        return response

    def test_first_time_deployment_creates_log(self):
        post_data = {
            'active': True,
            'backend': 'mock',
        }
        log_metadata = self._base_asset_detail_endpoint_test(
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
        log_metadata = self._base_asset_detail_endpoint_test(
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
        self._base_asset_detail_endpoint_test(
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
        self._base_asset_detail_endpoint_test(
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

    @data(True, False)
    def test_change_project_name_creates_log(self, use_v2):
        old_name = self.asset.name

        log_metadata = self._base_asset_detail_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data={'name': 'new_name'},
            expected_action=AuditAction.UPDATE_NAME,
            use_v2=use_v2,
        )

        self.assertEqual(
            log_metadata['name'][PROJECT_HISTORY_LOG_METADATA_FIELD_NEW], 'new_name'
        )
        self.assertEqual(
            log_metadata['name'][PROJECT_HISTORY_LOG_METADATA_FIELD_OLD], old_name
        )

    @data(True, False)
    def test_change_standard_project_settings_creates_log(self, use_v2):
        old_settings = copy.deepcopy(self.asset.settings)
        # both country and description are in Asset.STANDARDIZED_SETTINGS
        patch_data = {
            'settings': {
                'country': [{'label': 'Albania', 'value': 'ALB'}],
                'description': 'New description',
            }
        }

        log_metadata = self._base_asset_detail_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data=patch_data,
            expected_action=AuditAction.UPDATE_SETTINGS,
            use_v2=use_v2,
        )

        # check non-list settings just store old and new information
        settings_dict = log_metadata['settings']
        self.assertEqual(
            settings_dict['description'][PROJECT_HISTORY_LOG_METADATA_FIELD_OLD],
            old_settings['description'],
        )
        self.assertEqual(
            settings_dict['description'][PROJECT_HISTORY_LOG_METADATA_FIELD_NEW],
            'New description',
        )
        # check list settings store added and removed fields
        self.assertListEqual(
            settings_dict['country'][PROJECT_HISTORY_LOG_METADATA_FIELD_ADDED],
            [{'label': 'Albania', 'value': 'ALB'}],
        )
        self.assertListEqual(
            settings_dict['country'][PROJECT_HISTORY_LOG_METADATA_FIELD_REMOVED],
            [{'label': 'United States', 'value': 'USA'}],
        )
        # check default settings not recorded if not included in request
        for setting in Asset.STANDARDIZED_SETTINGS:
            # country codes are updated automatically when country is updated
            if setting not in ['country', 'settings', 'country_codes']:
                self.assertNotIn(setting, log_metadata)

    @data(True, False)
    def test_unchanged_settings_not_recorded_on_log(self, use_v2):
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
        log_metadata = self._base_asset_detail_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data=patch_data,
            expected_action=AuditAction.UPDATE_SETTINGS,
            use_v2=use_v2,
        )

        self.assertNotIn('sector', log_metadata)
        self.assertNotIn('country', log_metadata)
        self.assertNotIn('operational_purpose', log_metadata)
        self.assertNotIn('collects_pii', log_metadata)

    @data(True, False)
    def test_no_log_if_settings_unchanged(self, use_v2):
        # fill request with only existing values
        patch_data = {
            'settings': {
                'sector': self.asset.settings['sector'],
                'country': self.asset.settings['country'],
                'description': self.asset.settings['description'],
            }
        }
        url_name_prefix = 'api_v2:' if use_v2 else ''

        self.client.patch(
            reverse(f'{url_name_prefix}asset-detail', kwargs={'uid': self.asset.uid}),
            data=patch_data,
            format='json',
        )

        self.assertEqual(ProjectHistoryLog.objects.count(), 0)

    @data(True, False)
    def test_nullify_settings_creates_log(self, use_v2):
        old_settings = copy.deepcopy(self.asset.settings)

        log_metadata = self._base_asset_detail_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data={'settings': {}},
            expected_action=AuditAction.UPDATE_SETTINGS,
            use_v2=use_v2,
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
                    log_metadata['settings'][setting][
                        PROJECT_HISTORY_LOG_METADATA_FIELD_ADDED
                    ],
                    added_values,
                )
                self.assertListEqual(
                    log_metadata['settings'][setting][
                        PROJECT_HISTORY_LOG_METADATA_FIELD_REMOVED
                    ],
                    removed_values,
                )
            else:
                self.assertEqual(
                    log_metadata['settings'][setting][
                        PROJECT_HISTORY_LOG_METADATA_FIELD_NEW
                    ],
                    new_value,
                )
                self.assertEqual(
                    log_metadata['settings'][setting][
                        PROJECT_HISTORY_LOG_METADATA_FIELD_OLD
                    ],
                    old_value,
                )

    @data(True, False)
    def test_add_new_settings_creates_log(self, use_v2):
        log_metadata = self._base_asset_detail_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            # set a setting not in Asset.STANDARDIZED_SETTINGS
            request_data={'settings': {'new_setting': 'new_value'}},
            expected_action=AuditAction.UPDATE_SETTINGS,
            use_v2=use_v2,
        )

        self.assertEqual(
            log_metadata['settings']['new_setting'][
                PROJECT_HISTORY_LOG_METADATA_FIELD_NEW
            ],
            'new_value',
        )
        self.assertEqual(
            log_metadata['settings']['new_setting'][
                PROJECT_HISTORY_LOG_METADATA_FIELD_OLD
            ],
            None,
        )

    def test_enable_sharing_creates_log(self):
        log_metadata = self._base_asset_detail_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data={'data_sharing': {'enabled': True, 'fields': []}},
            expected_action=AuditAction.ENABLE_SHARING,
        )
        self.assertEqual(
            log_metadata['shared_fields'][PROJECT_HISTORY_LOG_METADATA_FIELD_ADDED], []
        )

    def test_truthy_field_creates_sharing_enabled_log(self):
        log_metadata = self._base_asset_detail_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data={'data_sharing': {'enabled': 'truthy'}},
            expected_action=AuditAction.ENABLE_SHARING,
        )
        self.assertEqual(
            log_metadata['shared_fields'][PROJECT_HISTORY_LOG_METADATA_FIELD_ADDED], []
        )

    def test_disable_sharing_creates_log(self):
        self.asset.data_sharing = {
            'enabled': True,
            'fields': [],
        }
        self.asset.save()

        self._base_asset_detail_endpoint_test(
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

        self._base_asset_detail_endpoint_test(
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

        self._base_asset_detail_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data={'data_sharing': {'enabled': 0}},
            expected_action=AuditAction.DISABLE_SHARING,
        )

    def test_modify_sharing_creates_log(self):
        self.asset.data_sharing = {
            'enabled': True,
            'fields': ['settings_fixture_q1'],
        }
        self.asset.save()
        log_metadata = self._base_asset_detail_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data={
                'data_sharing': {'enabled': True, 'fields': ['settings_fixture_q2']}
            },
            expected_action=AuditAction.MODIFY_SHARING,
        )
        self.assertEqual(
            log_metadata['shared_fields'][PROJECT_HISTORY_LOG_METADATA_FIELD_ADDED],
            ['settings_fixture_q2'],
        )
        self.assertEqual(
            log_metadata['shared_fields'][PROJECT_HISTORY_LOG_METADATA_FIELD_REMOVED],
            ['settings_fixture_q1'],
        )

    @data(True, False)
    def test_update_content_creates_log(self, use_v2):
        self._base_asset_detail_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data={'content': {'some': 'thing'}},
            expected_action=AuditAction.UPDATE_CONTENT,
            use_v2=use_v2,
        )

    def test_update_qa_creates_log(self):
        request_data = {
            'advanced_features': {
                'qual': {
                    'qual_survey': [
                        {
                            'type': 'qual_note',
                            'uuid': '12345',
                            'scope': 'by_question#survey',
                            'xpath': 'q1',
                            'labels': {'_default': 'QA Question'},
                            # requests to remove a question just add this
                            # option rather than actually deleting anything
                            'options': {'deleted': True},
                        }
                    ]
                }
            }
        }

        log_metadata = self._base_asset_detail_endpoint_test(
            patch=True,
            url_name=self.detail_url,
            request_data=request_data,
            expected_action=AuditAction.UPDATE_QA,
        )

        self.assertEqual(
            log_metadata['qa'][PROJECT_HISTORY_LOG_METADATA_FIELD_NEW],
            request_data['advanced_features']['qual']['qual_survey'],
        )

    def test_failed_qa_update_does_not_create_log(self):
        # badly formatted QA dict should result in an error before update
        request_data = {'advanced_features': {'qual': {'qual_survey': ['bad']}}}
        with self.assertRaises(jsonschema.exceptions.ValidationError):
            self.client.patch(
                reverse('api_v2:asset-detail', kwargs={'uid': self.asset.uid}),
                data=request_data,
                format='json',
            )

        self.assertEqual(ProjectHistoryLog.objects.count(), 0)

    @data(True, False)
    def test_register_service_creates_log(self, use_v2):
        request_data = {
            'name': 'test',
            'endpoint': 'http://www.google.com',
            'active': True,
            'subset_fields': [],
            'email_notification': True,
            'export_type': 'json',
            'auth_level': 'no_auth',
            'settings': {'custom_headers': {}},
            'payload_template': '',
        }
        url_prefix = 'api_v2:' if use_v2 else ''
        url = reverse(f'{url_prefix}hook-list', args=(self.asset.uid,))
        log_metadata = self._base_project_history_log_test(
            method=self.client.post,
            url=url,
            request_data=request_data,
            expected_action=AuditAction.REGISTER_SERVICE,
            expected_subtype=PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
        )
        new_hook = Hook.objects.get(name='test')
        self.assertEqual(log_metadata['hook']['uid'], new_hook.uid)
        self.assertEqual(log_metadata['hook']['active'], True)
        self.assertEqual(log_metadata['hook']['endpoint'], 'http://www.google.com')

    @data(True, False)
    def test_modify_service_creates_log(self, use_v2):
        new_hook = Hook.objects.create(
            name='test',
            endpoint='http://www.example.com',
            asset=self.asset,
        )
        new_hook.save()
        request_data = {
            'active': False,
        }
        url_prefix = 'api_v2:' if use_v2 else ''
        log_metadata = self._base_project_history_log_test(
            method=self.client.patch,
            url=reverse(
                f'{url_prefix}hook-detail',
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                    'uid': new_hook.uid,
                },
            ),
            request_data=request_data,
            expected_action=AuditAction.MODIFY_SERVICE,
            expected_subtype=PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
        )
        self.assertEqual(log_metadata['hook']['uid'], new_hook.uid)
        self.assertEqual(log_metadata['hook']['active'], False)
        self.assertEqual(log_metadata['hook']['endpoint'], 'http://www.example.com')

    @data(True, False)
    def test_delete_service_creates_log(self, use_v2):
        new_hook = Hook.objects.create(
            name='test',
            endpoint='http://www.example.com',
            asset=self.asset,
        )
        new_hook.save()
        request_data = {}
        url_prefix = 'api_v2:' if use_v2 else ''

        log_metadata = self._base_project_history_log_test(
            method=self.client.delete,
            url=reverse(
                f'{url_prefix}hook-detail',
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                    'uid': new_hook.uid,
                },
            ),
            request_data=request_data,
            expected_action=AuditAction.DELETE_SERVICE,
            expected_subtype=PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
        )
        self.assertEqual(log_metadata['hook']['uid'], new_hook.uid)
        self.assertEqual(log_metadata['hook']['active'], True)
        self.assertEqual(log_metadata['hook']['endpoint'], 'http://www.example.com')

    def test_connect_project_creates_log(self):
        source = Asset.objects.get(pk=1)
        source.data_sharing = {
            'enabled': True,
            'fields': [],
        }
        # set the owner to be the same on the source
        # so we don't have a permissions issue
        source.owner = self.asset.owner
        source.save()
        asset_url = drf_reverse('api_v2:asset-detail', kwargs={'uid': source.uid})
        request_data = {
            'fields': ['q1'],
            'filename': 'test_file',
            'source': asset_url,
        }

        url = reverse('api_v2:paired-data-list', args=(self.asset.uid,))
        log_metadata = self._base_project_history_log_test(
            method=self.client.post,
            url=url,
            request_data=request_data,
            expected_action=AuditAction.CONNECT_PROJECT,
            expected_subtype=PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
        )
        self.assertEqual(log_metadata['paired-data']['source_name'], source.name)
        self.assertEqual(log_metadata['paired-data']['source_uid'], source.uid)
        self.assertEqual(log_metadata['paired-data']['fields'], ['q1'])

    def test_disconnect_project_creates_log(self):
        source = Asset.objects.get(pk=1)
        source.data_sharing = {
            'enabled': True,
            'fields': [],
        }
        # set the owner to be the same on the source
        # so we don't have a permissions issue
        source.owner = self.asset.owner
        source.save()
        paired_data = PairedData(
            source_asset_or_uid=source,
            fields=['q1'],
            filename='data.txt',
            asset=self.asset,
        )
        paired_data.save()
        log_metadata = self._base_project_history_log_test(
            method=self.client.delete,
            url=reverse(
                'api_v2:paired-data-detail',
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                    'paired_data_uid': paired_data.paired_data_uid,
                },
            ),
            expected_action=AuditAction.DISCONNECT_PROJECT,
            request_data=None,
            expected_subtype=PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
        )
        self.assertEqual(log_metadata['paired-data']['source_name'], source.name)
        self.assertEqual(log_metadata['paired-data']['source_uid'], source.uid)

    def test_modify_imported_fields_creates_log(self):
        source = Asset.objects.get(pk=1)
        source.data_sharing = {
            'enabled': True,
            'fields': [],
        }
        # set the owner to be the same on the source
        # so we don't have a permissions issue
        source.owner = self.asset.owner
        source.save()
        paired_data = PairedData(
            source_asset_or_uid=source,
            fields=['q1'],
            filename='data.txt',
            asset=self.asset,
        )
        paired_data.save()
        log_metadata = self._base_project_history_log_test(
            method=self.client.patch,
            url=reverse(
                'api_v2:paired-data-detail',
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                    'paired_data_uid': paired_data.paired_data_uid,
                },
            ),
            expected_action=AuditAction.MODIFY_IMPORTED_FIELDS,
            request_data={'fields': ['q2']},
            expected_subtype=PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
        )
        self.assertEqual(log_metadata['paired-data']['source_name'], source.name)
        self.assertEqual(log_metadata['paired-data']['source_uid'], source.uid)
        self.assertEqual(log_metadata['paired-data']['fields'], ['q2'])

    @data(True, False)
    def test_add_media_creates_log(self, use_v2):
        crab_png_b64 = (
            'iVBORw0KGgoAAAANSUhEUgAAABIAAAAPAgMAAACU6HeBAAAADFBMVEU7PTqv'
            'OD/m6OX////GxYKhAAAAR0lEQVQI1y2MMQrAMAwD9Ul5yJQ1+Y8zm0Ig9iur'
            'kmo4xAmEUgJpaYE9y0VLBrwVO9ZzUnSODidlthgossXf73pNDltav88X3Ncm'
            'NcRl6K8AAAAASUVORK5CYII='
        )

        request_data = {
            'file_type': AssetFile.FORM_MEDIA,
            'description': 'I have pincers',
            'base64Encoded': 'data:image/png;base64,' + crab_png_b64,
            'metadata': json.dumps({'filename': 'crab.png'}),
        }
        url_prefix = 'api_v2:' if use_v2 else ''
        url = reverse(f'{url_prefix}asset-file-list', args=(self.asset.uid,))
        log_metadata = self._base_project_history_log_test(
            method=self.client.post,
            url=url,
            request_data=request_data,
            expected_action=AuditAction.ADD_MEDIA,
            expected_subtype=PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
        )
        file = AssetFile.objects.filter(asset=self.asset).first()
        self.assertEqual(log_metadata['asset-file']['uid'], file.uid)
        self.assertEqual(log_metadata['asset-file']['filename'], file.filename)
        self.assertEqual(log_metadata['asset-file']['download_url'], file.download_url)
        self.assertEqual(log_metadata['asset-file']['md5_hash'], file.md5_hash)

    @data(True, False)
    def test_delete_media_creates_log(self, use_v2):
        media = AssetFile.objects.create(
            asset=self.asset,
            user=self.user,
            file_type=AssetFile.FORM_MEDIA,
            description='A file',
            metadata={'filename': 'fish.txt'},
        )
        url_prefix = 'api_v2:' if use_v2 else ''
        log_metadata = self._base_project_history_log_test(
            method=self.client.delete,
            url=reverse(
                f'{url_prefix}asset-file-detail',
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                    'uid': media.uid,
                },
            ),
            expected_action=AuditAction.DELETE_MEDIA,
            request_data=None,
            expected_subtype=PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
        )
        self.assertEqual(log_metadata['asset-file']['uid'], media.uid)
        self.assertEqual(log_metadata['asset-file']['filename'], media.filename)
        self.assertEqual(log_metadata['asset-file']['download_url'], media.download_url)
        self.assertEqual(log_metadata['asset-file']['md5_hash'], media.md5_hash)

    @responses.activate
    @data(
        # File or url, change asset name?, use v2?
        ('file', True, True),
        ('file', False, True),
        ('url', True, True),
        ('url', False, True),
        ('file', True, False),
        ('file', False, False),
        ('url', True, False),
        ('url', False, False),
    )
    @unpack
    def test_create_from_import_task(self, file_or_url, change_name, use_v2):
        task_data = {
            'destination': reverse(
                'api_v2:asset-detail', kwargs={'uid': self.asset.uid}
            ),
            'name': 'name',
        }
        old_name = self.asset.name

        # create an xlsx file to import
        # if changing the name of the asset, create a file from an asset with
        # a different name and versioned=True, which will add the name to the
        # 'settings' sheet (only works for deployed assets)
        if change_name:
            new_asset = Asset.objects.get(pk=1)
            new_asset.save()
            new_asset.deploy(backend='mock')
            xlsx_io = new_asset.to_xlsx_io(versioned=True).read()
        else:
            xlsx_io = self.asset.to_xlsx_io().read()

        if file_or_url == 'url':
            # pretend to host the file somewhere
            mock_xls_url = 'http://mock.kbtdev.org/form.xls'
            responses.add(
                responses.GET,
                mock_xls_url,
                content_type='application/xls',
                body=xlsx_io,
            )
            task_data['url'] = mock_xls_url
        else:
            encoded_xls = base64.b64encode(xlsx_io)
            task_data['base64Encoded'] = ('base64:{}'.format(to_str(encoded_xls)),)

        # hit the endpoint that creates and runs the ImportTask
        # Task should complete right away due to `CELERY_TASK_ALWAYS_EAGER`
        version = 'v2' if use_v2 else 'v1'
        url_prefix = 'api_v2:' if use_v2 else ''
        with patch(
            f'kpi.views.{version}.import_task.get_client_ip', return_value='127.0.0.1'
        ):
            with patch(
                f'kpi.views.{version}.import_task.get_human_readable_client_user_agent',
                return_value='source',
            ):
                self.client.post(reverse(f'{url_prefix}importtask-list'), task_data)
        expected_logs_count = 2 if change_name else 1
        log_query = ProjectHistoryLog.objects.filter(metadata__asset_uid=self.asset.uid)
        self.assertEqual(log_query.count(), expected_logs_count)
        form_replace_log = log_query.filter(action=AuditAction.REPLACE_FORM).first()
        self.assertEqual(form_replace_log.object_id, self.asset.id)
        self._check_common_metadata(
            form_replace_log.metadata, PROJECT_HISTORY_LOG_PROJECT_SUBTYPE
        )
        self.assertEqual(
            form_replace_log.metadata['latest_version_uid'],
            self.asset.latest_version.uid,
        )

        if change_name:
            # if the import also changed the name of the asset,
            # check that was logged as well
            change_name_log = log_query.filter(action=AuditAction.UPDATE_NAME).first()
            self._check_common_metadata(
                change_name_log.metadata, PROJECT_HISTORY_LOG_PROJECT_SUBTYPE
            )
            self.assertEqual(
                change_name_log.metadata['latest_version_uid'],
                self.asset.latest_version.uid,
            )
            self.assertDictEqual(
                change_name_log.metadata['name'],
                {
                    PROJECT_HISTORY_LOG_METADATA_FIELD_OLD: old_name,
                    PROJECT_HISTORY_LOG_METADATA_FIELD_NEW: new_asset.name,
                },
            )

    def test_export_creates_log(self):
        self.asset.deploy(backend='mock', active=True)
        request_data = {
            'fields_from_all_versions': True,
            'fields': [],
            'group_sep': '/',
            'hierarchy_in_labels': False,
            'lang': '_default',
            'multiple_select': 'both',
            'type': 'xls',
            'xls_types_as_text': False,
            'include_media_url': True,
        }
        self._base_project_history_log_test(
            method=self.client.post,
            url=reverse(
                'api_v2:asset-export-list',
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                },
            ),
            expected_action=AuditAction.EXPORT,
            request_data=request_data,
            expected_subtype=PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
        )

    def test_export_v1_creates_log(self):
        self.asset.deploy(backend='mock', active=True)
        request_data = {
            'fields_from_all_versions': True,
            'fields': [],
            'group_sep': '/',
            'hierarchy_in_labels': False,
            'lang': '_default',
            'multiple_select': 'both',
            'type': 'xls',
            'xls_types_as_text': False,
            'include_media_url': True,
            'source': reverse('api_v2:asset-detail', kwargs={'uid': self.asset.uid}),
        }
        # can't use _base_project_history_log_test because
        # the old endpoint doesn't like format=json
        self.client.post(
            path=reverse('submissionexporttask-list'),
            data=request_data,
        )

        log_query = ProjectHistoryLog.objects.filter(
            metadata__asset_uid=self.asset.uid, action=AuditAction.EXPORT
        )
        self.assertEqual(log_query.count(), 1)
        log = log_query.first()
        self._check_common_metadata(log.metadata, PROJECT_HISTORY_LOG_PROJECT_SUBTYPE)
        self.assertEqual(log.object_id, self.asset.id)

    @data(
        ('archive', AuditAction.ARCHIVE),
        ('unarchive', AuditAction.UNARCHIVE),
        ('undelete', None),
        ('delete', None),
    )
    @unpack
    def test_bulk_actions(self, bulk_action, audit_action):
        assets = [Asset.objects.create(
            content={
                'survey': [
                    {
                        'type': 'text',
                        'label': 'Question 1',
                        'name': 'q1',
                        '$kuid': 'abc',
                    },
                ]
            },
            owner=self.user,
            asset_type='survey',
        ) for i in range(0, 2)]

        for asset in assets:
            asset.deploy(backend='mock', active=True)

        uids = [asset.uid for asset in assets]

        if bulk_action == 'undelete':
            self._make_bulk_request(uids, 'delete')

        self._make_bulk_request(uids, bulk_action)

        if audit_action is None:
            self.assertEqual(ProjectHistoryLog.objects.count(), 0)
        else:
            project_hist_logs = ProjectHistoryLog.objects.filter(
                object_id__in=[asset.id for asset in assets], action=audit_action
            )
            self.assertEqual(project_hist_logs.count(), 2)

    def test_bulk_permission_assignment_creates_logs_for_each_user(self):
        def get_user_url(username):
            return reverse('api_v2:user-kpi-detail', kwargs={'username': username})

        def get_permission_url(codename):
            return reverse('api_v2:permission-detail', kwargs={'codename': codename})

        request_data = [
            # assign simple perms to someuser and anotheruser
            {
                'permission': get_permission_url(PERM_VIEW_ASSET),
                'user': get_user_url('someuser'),
            },
            {
                'permission': get_permission_url(PERM_VIEW_ASSET),
                'user': get_user_url('anotheruser'),
            },
        ]
        self.client.post(
            path=reverse(
                'api_v2:asset-permission-assignment-bulk-assignments',
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                },
            ),
            data=request_data,
            format='json',
        )
        self.assertEqual(ProjectHistoryLog.objects.count(), 2)
        someuser_log = ProjectHistoryLog.objects.filter(
            metadata__permissions__username='someuser'
        ).first()
        anotheruser_log = ProjectHistoryLog.objects.filter(
            metadata__permissions__username='anotheruser'
        ).first()
        self._check_common_metadata(
            someuser_log.metadata, PROJECT_HISTORY_LOG_PERMISSION_SUBTYPE
        )
        self._check_common_metadata(
            anotheruser_log.metadata, PROJECT_HISTORY_LOG_PERMISSION_SUBTYPE
        )
        self.assertListEqual(
            someuser_log.metadata['permissions'][
                PROJECT_HISTORY_LOG_METADATA_FIELD_ADDED
            ],
            [PERM_VIEW_ASSET],
        )
        self.assertListEqual(
            anotheruser_log.metadata['permissions'][
                PROJECT_HISTORY_LOG_METADATA_FIELD_ADDED
            ],
            [PERM_VIEW_ASSET],
        )
        self.assertListEqual(
            someuser_log.metadata['permissions'][
                PROJECT_HISTORY_LOG_METADATA_FIELD_REMOVED
            ],
            [],
        )
        self.assertListEqual(
            anotheruser_log.metadata['permissions'][
                PROJECT_HISTORY_LOG_METADATA_FIELD_REMOVED
            ],
            [],
        )
        self.assertEqual(someuser_log.action, AuditAction.MODIFY_USER_PERMISSIONS)
        self.assertEqual(anotheruser_log.action, AuditAction.MODIFY_USER_PERMISSIONS)

    @data(
        # permission, use bulk endpoint, expected action, expected inverse action
        (
            PERM_VIEW_ASSET,
            True,
            AuditAction.SHARE_FORM_PUBLICLY,
            AuditAction.UNSHARE_FORM_PUBLICLY,
        ),
        (
            PERM_VIEW_SUBMISSIONS,
            True,
            AuditAction.SHARE_DATA_PUBLICLY,
            AuditAction.UNSHARE_DATA_PUBLICLY,
        ),
        (
            PERM_ADD_SUBMISSIONS,
            True,
            AuditAction.ALLOW_ANONYMOUS_SUBMISSIONS,
            AuditAction.DISALLOW_ANONYMOUS_SUBMISSIONS,
        ),
        (
            PERM_VIEW_ASSET,
            False,
            AuditAction.SHARE_FORM_PUBLICLY,
            AuditAction.UNSHARE_FORM_PUBLICLY,
        ),
        (
            PERM_VIEW_SUBMISSIONS,
            False,
            AuditAction.SHARE_DATA_PUBLICLY,
            AuditAction.UNSHARE_DATA_PUBLICLY,
        ),
        (
            PERM_ADD_SUBMISSIONS,
            False,
            AuditAction.ALLOW_ANONYMOUS_SUBMISSIONS,
            AuditAction.DISALLOW_ANONYMOUS_SUBMISSIONS,
        ),
    )
    @unpack
    def test_create_permission_creates_logs_for_anonymous_user(
        self, permission, use_bulk, expected_action, expected_inverse_action
    ):
        request_data = {
            'permission': reverse(
                'api_v2:permission-detail', kwargs={'codename': permission}
            ),
            'user': reverse(
                'api_v2:user-kpi-detail', kwargs={'username': 'AnonymousUser'}
            ),
        }
        # /bulk expects assignments to come in a list
        if use_bulk:
            request_data = [request_data]
        endpoint = 'bulk-assignments' if use_bulk else 'list'
        self.client.post(
            path=reverse(
                f'api_v2:asset-permission-assignment-{endpoint}',
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                },
            ),
            data=request_data,
            format='json',
        )
        log = ProjectHistoryLog.objects.filter(action=expected_action).first()
        self.assertEqual(log.action, expected_action)
        self._check_common_metadata(
            log.metadata, PROJECT_HISTORY_LOG_PERMISSION_SUBTYPE
        )

        # get the permission that was created
        perm = ObjectPermission.objects.filter(
            user__username='AnonymousUser', permission__codename=permission
        ).first()
        # request to delete the permission we just created
        self.client.delete(
            path=reverse(
                'api_v2:asset-permission-assignment-detail',
                kwargs={'parent_lookup_asset': self.asset.uid, 'uid': perm.uid},
            ),
        )
        removal_log = ProjectHistoryLog.objects.filter(
            action=expected_inverse_action
        ).first()
        self._check_common_metadata(
            removal_log.metadata, PROJECT_HISTORY_LOG_PERMISSION_SUBTYPE
        )

    # use bulk endpoint? (as opposed to -detail)
    @data(True, False)
    def test_modify_permissions_log_includes_implied(self, use_bulk):
        request_data = {
            # change_submissions implies view_submissions, add_submissions,
            # and view_asset
            'permission': reverse(
                'api_v2:permission-detail', kwargs={'codename': PERM_CHANGE_SUBMISSIONS}
            ),
            'user': reverse('api_v2:user-kpi-detail', kwargs={'username': 'someuser'}),
        }
        if use_bulk:
            request_data = [request_data]
        endpoint = 'bulk-assignments' if use_bulk else 'list'
        self.client.post(
            path=reverse(
                f'api_v2:asset-permission-assignment-{endpoint}',
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                },
            ),
            data=request_data,
            format='json',
        )
        self.assertEqual(ProjectHistoryLog.objects.count(), 1)
        log = ProjectHistoryLog.objects.filter(
            action=AuditAction.MODIFY_USER_PERMISSIONS
        ).first()
        self._check_common_metadata(
            log.metadata, PROJECT_HISTORY_LOG_PERMISSION_SUBTYPE
        )
        self.assertListEqual(
            sorted(
                log.metadata['permissions'][PROJECT_HISTORY_LOG_METADATA_FIELD_ADDED]
            ),
            ['add_submissions', 'change_submissions', 'view_asset', 'view_submissions'],
        )
        self.assertListEqual(
            log.metadata['permissions'][PROJECT_HISTORY_LOG_METADATA_FIELD_REMOVED], []
        )
        self.assertEqual(log.metadata['permissions']['username'], 'someuser')

        # removing view_asset should remove view_submissions and change_submissions
        view_asset_perm = ObjectPermission.objects.filter(
            user__username='someuser', permission__codename=PERM_VIEW_ASSET
        ).first()
        self.client.delete(
            path=reverse(
                'api_v2:asset-permission-assignment-detail',
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                    'uid': view_asset_perm.uid,
                },
            ),
        )
        self.assertEqual(ProjectHistoryLog.objects.count(), 2)
        removal_log = (
            ProjectHistoryLog.objects.filter(action=AuditAction.MODIFY_USER_PERMISSIONS)
            .order_by('-date_created')
            .first()
        )
        self.assertListEqual(
            removal_log.metadata['permissions'][
                PROJECT_HISTORY_LOG_METADATA_FIELD_ADDED
            ],
            [],
        )
        self.assertListEqual(
            sorted(
                removal_log.metadata['permissions'][
                    PROJECT_HISTORY_LOG_METADATA_FIELD_REMOVED
                ]
            ),
            ['change_submissions', 'view_asset', 'view_submissions'],
        )
        self.assertEqual(removal_log.metadata['permissions']['username'], 'someuser')

    @data(True, False)
    def test_create_partial_permission_creates_log(self, use_bulk):
        request_data = {
            # partial change_submissions implies partial view_submissions,
            # add_submissions, and view_asset
            'permission': reverse(
                'api_v2:permission-detail',
                kwargs={'codename': PERM_PARTIAL_SUBMISSIONS},
            ),
            'user': reverse('api_v2:user-kpi-detail', kwargs={'username': 'someuser'}),
            'partial_permissions': [
                {
                    'url': reverse(
                        'api_v2:permission-detail',
                        kwargs={'codename': PERM_CHANGE_SUBMISSIONS},
                    ),
                    'filters': [{'_submitted_by': 'someuser'}],
                }
            ],
        }
        if use_bulk:
            request_data = [request_data]
        endpoint = 'bulk-assignments' if use_bulk else 'list'
        self.client.post(
            path=reverse(
                f'api_v2:asset-permission-assignment-{endpoint}',
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                },
            ),
            data=request_data,
            format='json',
        )
        self.assertEqual(ProjectHistoryLog.objects.count(), 1)
        log = ProjectHistoryLog.objects.filter(
            action=AuditAction.MODIFY_USER_PERMISSIONS
        ).first()
        self._check_common_metadata(
            log.metadata, PROJECT_HISTORY_LOG_PERMISSION_SUBTYPE
        )
        # can't sort a list of strings and dicts,
        # so check length and expected entries individually
        added = log.metadata['permissions'][PROJECT_HISTORY_LOG_METADATA_FIELD_ADDED]
        self.assertEqual(len(added), 6)
        # adding partial permissions always adds 'add_submissions',
        # both partial and full
        self.assertIn(PERM_ADD_SUBMISSIONS, added)
        self.assertIn(PERM_VIEW_ASSET, added)
        self.assertIn(PERM_PARTIAL_SUBMISSIONS, added)

        # inherited partial permissions
        self.assertIn(
            {
                'code': PERM_CHANGE_SUBMISSIONS,
                'filters': [{'_submitted_by': 'someuser'}],
            },
            added,
        )
        self.assertIn(
            {'code': PERM_VIEW_SUBMISSIONS, 'filters': [{'_submitted_by': 'someuser'}]},
            added,
        )
        self.assertIn(
            {'code': PERM_ADD_SUBMISSIONS, 'filters': [{'_submitted_by': 'someuser'}]},
            added,
        )

        self.assertListEqual(
            log.metadata['permissions'][PROJECT_HISTORY_LOG_METADATA_FIELD_REMOVED], []
        )
        self.assertEqual(log.metadata['permissions']['username'], 'someuser')

        # removing view_asset should remove view_submissions and change_submissions
        partial_submissions_perm = ObjectPermission.objects.filter(
            user__username='someuser', permission__codename=PERM_PARTIAL_SUBMISSIONS
        ).first()
        self.client.delete(
            path=reverse(
                'api_v2:asset-permission-assignment-detail',
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                    'uid': partial_submissions_perm.uid,
                },
            ),
        )
        self.assertEqual(ProjectHistoryLog.objects.count(), 2)
        removal_log = (
            ProjectHistoryLog.objects.filter(action=AuditAction.MODIFY_USER_PERMISSIONS)
            .order_by('-date_created')
            .first()
        )
        self.assertListEqual(
            removal_log.metadata['permissions'][
                PROJECT_HISTORY_LOG_METADATA_FIELD_ADDED
            ],
            [],
        )
        # we don't record what exact partial permissions were lost since all of them
        # are removed at once
        self.assertListEqual(
            sorted(
                removal_log.metadata['permissions'][
                    PROJECT_HISTORY_LOG_METADATA_FIELD_REMOVED
                ]
            ),
            ['partial_submissions'],
        )
        self.assertEqual(removal_log.metadata['permissions']['username'], 'someuser')

    def test_no_logs_if_no_permissions_change(self):
        someuser = User.objects.get(username='someuser')
        # assign a permission someone already has
        self.asset.assign_perm(user_obj=someuser, perm=PERM_VIEW_ASSET)
        self.client.post(
            path=reverse(
                'api_v2:asset-permission-assignment-list',
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                },
            ),
            data={
                'permission': reverse(
                    'api_v2:permission-detail', kwargs={'codename': PERM_VIEW_ASSET}
                ),
                'user': reverse(
                    'api_v2:user-kpi-detail', kwargs={'username': 'someuser'}
                ),
            },
            format='json',
        )
        self.assertEqual(ProjectHistoryLog.objects.count(), 0)

    def test_no_logs_if_bulk_request_fails(self):
        someuser = User.objects.get(username='someuser')
        self.asset.assign_perm(user_obj=someuser, perm=PERM_VIEW_ASSET)
        data = [
            {
                'permission': reverse(
                    'api_v2:permission-detail', kwargs={'codename': PERM_VIEW_ASSET}
                ),
                'user': reverse(
                    'api_v2:user-kpi-detail', kwargs={'username': 'someuser'}
                ),
            },
            # trying to assign a permission to an admin will fail the request
            {
                'permission': reverse(
                    'api_v2:permission-detail', kwargs={'codename': PERM_VIEW_ASSET}
                ),
                'user': reverse(
                    'api_v2:user-kpi-detail', kwargs={'username': 'adminuser'}
                ),
            },
        ]
        self.client.post(
            path=reverse(
                'api_v2:asset-permission-assignment-bulk-assignments',
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                },
            ),
            data=data,
            format='json',
        )
        self.assertEqual(ProjectHistoryLog.objects.count(), 0)

    def test_clone_permissions_creates_logs(self):
        second_asset = Asset.objects.get(pk=2)
        log_metadata = self._base_project_history_log_test(
            method=self.client.patch,
            url=reverse(
                'api_v2:asset-permission-assignment-clone',
                kwargs={'parent_lookup_asset': self.asset.uid},
            ),
            request_data={CLONE_ARG_NAME: second_asset.uid},
            expected_action=AuditAction.CLONE_PERMISSIONS,
            expected_subtype=PROJECT_HISTORY_LOG_PERMISSION_SUBTYPE,
        )
        self.assertEqual(log_metadata['cloned_from'], second_asset.uid)

    def test_transfer_creates_log(self):
        log_metadata = self._base_project_history_log_test(
            method=self.client.post,
            url=reverse(
                'api_v2:project-ownership-invite-list',
            ),
            request_data={
                'recipient': reverse(
                    'api_v2:user-kpi-detail', kwargs={'username': 'someuser'}
                ),
                'assets': [self.asset.uid],
            },
            expected_action=AuditAction.TRANSFER,
            expected_subtype=PROJECT_HISTORY_LOG_PERMISSION_SUBTYPE,
        )
        self.assertEqual(log_metadata['username'], 'someuser')

    def test_transfer_multiple_creates_logs(self):
        second_asset = Asset.objects.get(pk=2)
        # make admin the owner of the other asset so we can transfer it
        second_asset.owner = self.user
        second_asset.save()
        self.client.post(
            path=reverse('api_v2:project-ownership-invite-list'),
            data={
                'recipient': reverse(
                    'api_v2:user-kpi-detail', kwargs={'username': 'someuser'}
                ),
                'assets': [self.asset.uid, second_asset.uid],
            },
        )
        self.assertEqual(ProjectHistoryLog.objects.count(), 2)
        first_log = ProjectHistoryLog.objects.filter(
            metadata__asset_uid=self.asset.uid, action=AuditAction.TRANSFER
        )
        self.assertTrue(first_log.exists())
        second_log = ProjectHistoryLog.objects.filter(
            metadata__asset_uid=second_asset.uid, action=AuditAction.TRANSFER
        )
        self.assertTrue(second_log.exists())

    def test_no_log_created_for_non_project_transfer(self):
        new_asset = Asset.objects.create(
            owner=self.user,
            asset_type=ASSET_TYPE_TEMPLATE,
        )
        self.client.post(
            path=reverse('api_v2:project-ownership-invite-list'),
            data={
                'recipient': reverse(
                    'api_v2:user-kpi-detail', kwargs={'username': 'someuser'}
                ),
                'assets': [new_asset.uid],
            },
        )
        self.assertEqual(ProjectHistoryLog.objects.count(), 0)

    @data('adminuser', 'someuser')
    def test_log_created_for_duplicate_submission(self, duplicating_user):
        self._add_submission('adminuser')
        submissions = self.asset.deployment.get_submissions(
            self.asset.owner, fields=['_id']
        )
        submission = submissions[0]
        submission_url = reverse(
            self._get_endpoint('submission-duplicate'),
            kwargs={
                'parent_lookup_asset': self.asset.uid,
                'pk': submission['_id'],
            },
        )
        # whoever performs the duplication request will be considered the submitter
        # of the new submission, even if the original was submitted by someone else
        user = User.objects.get(username=duplicating_user)
        self.asset.assign_perm(user_obj=user, perm=PERM_MANAGE_ASSET)
        self.client.force_login(user)

        metadata = self._base_project_history_log_test(
            method=self.client.post,
            url=submission_url,
            request_data={},
            expected_action=AuditAction.ADD_SUBMISSION,
            expected_subtype=PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
        )
        self.assertEqual(metadata['submission']['submitted_by'], duplicating_user)

    @data('adminuser', None)
    def test_update_one_submission_content(self, username):
        self._add_submission(username)
        submissions_xml = self.asset.deployment.get_submissions(
            self.asset.owner, format_type='xml'
        )
        submission_xml = submissions_xml[0]
        submissions_json = self.asset.deployment.get_submissions(self.asset.owner)
        submission_json = submissions_json[0]

        xml_parsed = fromstring_preserve_root_xmlns(submission_xml)
        edit_submission_xml(
            xml_parsed, 'meta/deprecatedID', submission_json['meta/instanceID']
        )
        edit_submission_xml(xml_parsed, 'meta/instanceID', 'foo')
        edit_submission_xml(xml_parsed, 'Q1', 'new answer')
        edited_submission = xml_tostring(xml_parsed)
        url = reverse(
            self._get_endpoint('api_v2:assetsnapshot-submission-alias'),
            args=(self.asset.snapshot().uid,),
        )
        data = {
            'xml_submission_file': SimpleUploadedFile(
                'name.txt', edited_submission.encode()
            )
        }
        self.client.post(
            path=url,
            data=data,
            format='multipart',
        )
        self.asset.refresh_from_db()

        # make sure a log was created
        logs = ProjectHistoryLog.objects.filter(metadata__asset_uid=self.asset.uid)
        self.assertEqual(logs.count(), 1)
        log = logs.first()
        # check the log has the expected fields and metadata
        self.assertEqual(log.object_id, self.asset.id)
        self.assertEqual(log.action, AuditAction.MODIFY_SUBMISSION)
        self._check_common_metadata(log.metadata, PROJECT_HISTORY_LOG_PROJECT_SUBTYPE)
        submitted_by = username if username is not None else 'AnonymousUser'
        self.assertEqual(log.metadata['submission']['submitted_by'], submitted_by)

    def test_update_multiple_submissions_content(self):
        self._add_submission('adminuser')
        self._add_submission('someuser')
        self._add_submission(None)

        submissions_json = self.asset.deployment.get_submissions(
            self.asset.owner, fields=['_id']
        )
        payload = json.dumps(
            {
                'submission_ids': [sub['_id'] for sub in submissions_json],
                'data': {'Q1': 'new_answer'},
            }
        )

        self.client.patch(
            path=reverse(
                'api_v2:submission-bulk', kwargs={'parent_lookup_asset': self.asset.uid}
            ),
            data={'payload': payload},
            format='json',
        )

        self.assertEqual(ProjectHistoryLog.objects.count(), 3)
        log1 = ProjectHistoryLog.objects.filter(
            metadata__submission__submitted_by='adminuser'
        ).first()
        self._check_common_metadata(log1.metadata, PROJECT_HISTORY_LOG_PROJECT_SUBTYPE)
        self.assertEqual(log1.action, AuditAction.MODIFY_SUBMISSION)

        log2 = ProjectHistoryLog.objects.filter(
            metadata__submission__submitted_by='someuser'
        ).first()
        self._check_common_metadata(log2.metadata, PROJECT_HISTORY_LOG_PROJECT_SUBTYPE)
        self.assertEqual(log2.action, AuditAction.MODIFY_SUBMISSION)

        log2 = ProjectHistoryLog.objects.filter(
            metadata__submission__submitted_by='AnonymousUser'
        ).first()
        self._check_common_metadata(log2.metadata, PROJECT_HISTORY_LOG_PROJECT_SUBTYPE)
        self.assertEqual(log2.action, AuditAction.MODIFY_SUBMISSION)

    @data('adminuser', None)
    def test_update_single_submission_validation_status(self, username):
        self._add_submission(username)
        submissions_json = self.asset.deployment.get_submissions(
            self.asset.owner, fields=['_id']
        )
        log_metadata = self._base_project_history_log_test(
            method=self.client.patch,
            url=reverse(
                'api_v2:submission-validation-status',
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                    'pk': submissions_json[0]['_id'],
                },
            ),
            request_data={'validation_status.uid': 'validation_status_on_hold'},
            expected_action=AuditAction.MODIFY_SUBMISSION,
            expected_subtype=PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
        )
        expected_username = username if username is not None else 'AnonymousUser'
        self.assertEqual(log_metadata['submission']['submitted_by'], expected_username)
        self.assertEqual(log_metadata['submission']['status'], 'On Hold')

    def test_multiple_submision_validation_statuses(self):
        self._add_submission('adminuser')
        self._add_submission('someuser')
        self._add_submission(None)
        submissions_json = self.asset.deployment.get_submissions(
            self.asset.owner, fields=['_id']
        )
        payload = json.dumps(
            {
                'submission_ids': [sub['_id'] for sub in submissions_json],
                'validation_status.uid': 'validation_status_on_hold',
            }
        )

        self.client.patch(
            path=reverse(
                'api_v2:submission-validation-statuses',
                kwargs={'parent_lookup_asset': self.asset.uid},
            ),
            data={'payload': payload},
            format='json',
        )

        self.assertEqual(ProjectHistoryLog.objects.count(), 3)
        log1 = ProjectHistoryLog.objects.filter(
            metadata__submission__submitted_by='adminuser'
        ).first()
        self._check_common_metadata(log1.metadata, PROJECT_HISTORY_LOG_PROJECT_SUBTYPE)
        self.assertEqual(log1.action, AuditAction.MODIFY_SUBMISSION)
        self.assertEqual(log1.metadata['submission']['status'], 'On Hold')

        log2 = ProjectHistoryLog.objects.filter(
            metadata__submission__submitted_by='someuser'
        ).first()
        self._check_common_metadata(log2.metadata, PROJECT_HISTORY_LOG_PROJECT_SUBTYPE)
        self.assertEqual(log2.action, AuditAction.MODIFY_SUBMISSION)
        self.assertEqual(log2.metadata['submission']['status'], 'On Hold')

        log3 = ProjectHistoryLog.objects.filter(
            metadata__submission__submitted_by='AnonymousUser'
        ).first()
        self._check_common_metadata(log3.metadata, PROJECT_HISTORY_LOG_PROJECT_SUBTYPE)
        self.assertEqual(log3.action, AuditAction.MODIFY_SUBMISSION)
        self.assertEqual(log3.metadata['submission']['status'], 'On Hold')

    @data(
        # submit as anonymous?, use v1 endpoint?
        (True, False),
        (False, True),
        (False, False),
    )
    @unpack
    def test_add_submission(self, anonymous, v1):
        # prepare submission data
        uuid_ = uuid.uuid4()
        self.asset.deploy(backend='mock')
        submission_data = {
            'q1': 'answer',
            'q2': 'answer',
            'meta': {'instanceID': f'uuid:{uuid_}'},
            'formhub': {'uuid': self.asset.deployment.xform.uuid},
            '_uuid': str(uuid_),
        }
        xml = ET.fromstring(
            dict2xform(submission_data, self.asset.deployment.xform.id_string)
        )
        xml.tag = self.asset.uid
        xml.attrib = {
            'id': self.asset.uid,
            'version': self.asset.latest_version.uid,
        }
        endpoint = 'submissions-list' if v1 else 'submissions'
        kwargs = {'username': self.user.username} if not v1 else {}
        url = reverse(
            self._get_endpoint(endpoint),
            kwargs=kwargs,
        )
        data = {'xml_submission_file': SimpleUploadedFile('name.txt', ET.tostring(xml))}
        # ensure anonymous users are allowed to submit
        self.asset.assign_perm(perm=PERM_ADD_SUBMISSIONS, user_obj=AnonymousUser())

        if not anonymous:
            # the submission endpoints don't allow session authentication, so
            # just force the request to attach the correct user
            self.client.force_authenticate(user=self.user)

        # can't use _base_project_history_log_test here because our format is xml,
        # not json
        self.client.post(
            url,
            data=data,
        )
        logs = ProjectHistoryLog.objects.filter(metadata__asset_uid=self.asset.uid)
        self.assertEqual(logs.count(), 1)
        log = logs.first()

        self.assertEqual(log.object_id, self.asset.id)
        self.assertEqual(log.action, AuditAction.ADD_SUBMISSION)
        self._check_common_metadata(log.metadata, PROJECT_HISTORY_LOG_PROJECT_SUBTYPE)
        username = 'AnonymousUser' if anonymous else self.user.username
        self.assertEqual(log.metadata['submission']['submitted_by'], username)

    def test_delete_single_submission(self):
        self._add_submission('adminuser')
        submissions_json = self.asset.deployment.get_submissions(
            self.asset.owner, fields=['_id']
        )
        log_metadata = self._base_project_history_log_test(
            method=self.client.delete,
            url=reverse(
                'api_v2:submission-detail',
                kwargs={
                    'parent_lookup_asset': self.asset.uid,
                    'pk': submissions_json[0]['_id'],
                },
            ),
            request_data={},
            expected_action=AuditAction.DELETE_SUBMISSION,
            expected_subtype=PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
        )
        self.assertEqual(log_metadata['submission']['submitted_by'], 'adminuser')

    @data(True, False)
    def test_delete_multiple_submissions(self, simulate_error):
        self._add_submission('adminuser')
        self._add_submission('someuser')
        self._add_submission(None)
        submissions_json = self.asset.deployment.get_submissions(
            self.asset.owner, fields=['_id']
        )
        payload = json.dumps(
            {
                'submission_ids': [sub['_id'] for sub in submissions_json],
            }
        )
        if simulate_error:
            # tell the client to return a 500 like a normal request would
            # instead of raising errors directly
            self.client.raise_request_exception = False

            # simulate a DB error
            mongo_patcher = patch(
                'kobo.apps.openrosa.apps.viewer.models.parsed_instance.xform_instances.delete_many',  # noqa
                side_effect=PyMongoError(),
            )
            mongo_patcher.start()
        self.client.delete(
            path=reverse(
                'api_v2:submission-bulk',
                kwargs={'parent_lookup_asset': self.asset.uid},
            ),
            data={'payload': payload},
            format='json',
        )
        if simulate_error:
            mongo_patcher.stop()

        self.assertEqual(ProjectHistoryLog.objects.count(), 3)
        log1 = ProjectHistoryLog.objects.filter(
            metadata__submission__submitted_by='adminuser'
        ).first()
        self._check_common_metadata(log1.metadata, PROJECT_HISTORY_LOG_PROJECT_SUBTYPE)
        self.assertEqual(log1.action, AuditAction.DELETE_SUBMISSION)

        log2 = ProjectHistoryLog.objects.filter(
            metadata__submission__submitted_by='someuser'
        ).first()
        self._check_common_metadata(log2.metadata, PROJECT_HISTORY_LOG_PROJECT_SUBTYPE)
        self.assertEqual(log2.action, AuditAction.DELETE_SUBMISSION)

        log3 = ProjectHistoryLog.objects.filter(
            metadata__submission__submitted_by='AnonymousUser'
        ).first()
        self._check_common_metadata(log2.metadata, PROJECT_HISTORY_LOG_PROJECT_SUBTYPE)
        self.assertEqual(log3.action, AuditAction.DELETE_SUBMISSION)
