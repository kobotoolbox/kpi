import datetime
from datetime import timedelta
from unittest.mock import Mock, patch

from ddt import data, ddt, unpack
from django.contrib.auth.models import AnonymousUser
from django.test.client import RequestFactory
from django.urls import resolve, reverse
from django.utils import timezone
from jsonschema.exceptions import ValidationError

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import (
    ACCESS_LOG_LOGINAS_AUTH_TYPE,
    ACCESS_LOG_UNKNOWN_AUTH_TYPE,
    AccessLog,
    AuditLog,
    AuditType,
    ProjectHistoryLog,
)
from kobo.apps.audit_log.utils import SubmissionUpdate
from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import (
    ACCESS_LOG_SUBMISSION_AUTH_TYPE,
    ACCESS_LOG_SUBMISSION_GROUP_AUTH_TYPE,
    PROJECT_HISTORY_LOG_METADATA_FIELD_ADDED,
    PROJECT_HISTORY_LOG_METADATA_FIELD_REMOVED,
    PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
)
from kpi.models import Asset, ImportTask
from kpi.tests.base_test_case import BaseTestCase


class BaseAuditLogTestCase(BaseTestCase):
    def setUp(self):
        source_patcher = patch(
            'kobo.apps.audit_log.models.get_human_readable_client_user_agent',
            return_value='source',
        )
        ip_patcher = patch(
            'kobo.apps.audit_log.models.get_client_ip', return_value='127.0.0.1'
        )
        source_patcher.start()
        ip_patcher.start()
        self.addCleanup(source_patcher.stop)
        self.addCleanup(ip_patcher.stop)


class AccessLogModelTestCase(BaseAuditLogTestCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.super_user = User.objects.create_user(
            'user', 'user@example.com', 'userpass'
        )
        cls.super_user.is_super = True
        cls.super_user.backend = 'django.contrib.auth.backends.ModelBackend'
        cls.super_user.save()

    def _create_request(self, url: str, cached_user, new_user):
        factory = RequestFactory()
        request = factory.post(url)
        request.user = new_user
        request._cached_user = cached_user
        request.resolver_match = resolve(url)
        return request

    def _check_common_fields(self, access_log: AccessLog, user):
        self.assertEqual(access_log.user.id, user.id)
        self.assertEqual(access_log.app_label, 'kobo_auth')
        self.assertEqual(access_log.model_name, 'user')
        self.assertEqual(access_log.object_id, user.id)
        self.assertEqual(access_log.user_uid, user.extra_details.uid)
        self.assertEqual(access_log.action, AuditAction.AUTH)
        self.assertEqual(access_log.log_type, AuditType.ACCESS)

    def test_create_access_log_sets_standard_fields(self):
        yesterday = timezone.now() - timedelta(days=1)
        log = AccessLog.objects.create(
            user=AccessLogModelTestCase.super_user,
            metadata={'foo': 'bar'},
            date_created=yesterday,
        )
        self._check_common_fields(log, AccessLogModelTestCase.super_user)
        self.assertEqual(log.date_created, yesterday)
        self.assertDictEqual(log.metadata, {'foo': 'bar'})

    @patch('kobo.apps.audit_log.models.logging.warning')
    def test_create_access_log_ignores_attempt_to_override_standard_fields(
        self, patched_warning
    ):
        log = AccessLog.objects.create(
            log_type=AuditType.DATA_EDITING,
            action=AuditAction.CREATE,
            model_name='foo',
            app_label='bar',
            user=AccessLogModelTestCase.super_user,
        )
        # the standard fields should be set the same as any other access logs
        self._check_common_fields(log, AccessLogModelTestCase.super_user)
        # we logged a warning for each attempt to override a field
        self.assertEqual(patched_warning.call_count, 4)

    def test_basic_create_auth_log_from_request(self):
        request = self._create_request(
            reverse('kobo_login'),
            AnonymousUser(),
            AccessLogModelTestCase.super_user,
        )
        log: AccessLog = AccessLog.create_from_request(request)
        self._check_common_fields(log, AccessLogModelTestCase.super_user)
        self.assertDictEqual(
            log.metadata,
            {
                'ip_address': '127.0.0.1',
                'source': 'source',
                'auth_type': AccessLogModelTestCase.super_user.backend,
            },
        )

    def test_create_auth_log_from_loginas_request(self):
        second_user = User.objects.create_user(
            'second_user', 'second@example.com', 'pass'
        )
        second_user.save()
        request = self._create_request(
            reverse('loginas-user-login', args=(second_user.id,)),
            AccessLogModelTestCase.super_user,
            second_user,
        )
        log: AccessLog = AccessLog.create_from_request(request)
        self._check_common_fields(log, second_user)
        self.assertDictEqual(
            log.metadata,
            {
                'ip_address': '127.0.0.1',
                'source': 'source',
                'auth_type': ACCESS_LOG_LOGINAS_AUTH_TYPE,
                'initial_user_uid': AccessLogModelTestCase.super_user.extra_details.uid,
                'initial_user_username': AccessLogModelTestCase.super_user.username,
            },
        )

    def test_create_auth_log_with_different_auth_type(self):
        request = self._create_request(
            reverse('api_v2:asset-list'),
            AnonymousUser(),
            AccessLogModelTestCase.super_user,
        )
        log: AccessLog = AccessLog.create_from_request(
            request, authentication_type='Token'
        )
        self._check_common_fields(log, AccessLogModelTestCase.super_user)
        self.assertDictEqual(
            log.metadata,
            {
                'ip_address': '127.0.0.1',
                'source': 'source',
                'auth_type': 'Token',
            },
        )

    def test_create_auth_log_unknown_authenticator(self):
        # no backend attached to the user object
        second_user = User.objects.create_user(
            'second_user', 'second@example.com', 'pass'
        )
        second_user.save()
        request = self._create_request(
            reverse('api_v2:asset-list'),
            AccessLogModelTestCase.super_user,
            second_user,
        )
        log: AccessLog = AccessLog.create_from_request(request)
        self._check_common_fields(log, second_user)
        self.assertDictEqual(
            log.metadata,
            {
                'ip_address': '127.0.0.1',
                'source': 'source',
                'auth_type': ACCESS_LOG_UNKNOWN_AUTH_TYPE,
            },
        )

    def test_create_auth_log_with_extra_metadata(self):
        request = self._create_request(
            reverse('api_v2:asset-list'),
            AnonymousUser(),
            AccessLogModelTestCase.super_user,
        )
        extra_metadata = {'foo': 'bar'}
        log: AccessLog = AccessLog.create_from_request(
            request, authentication_type='Token', extra_metadata=extra_metadata
        )
        self._check_common_fields(log, AccessLogModelTestCase.super_user)
        self.assertDictEqual(
            log.metadata,
            {
                'ip_address': '127.0.0.1',
                'source': 'source',
                'auth_type': 'Token',
                'foo': 'bar',
            },
        )


class AccessLogModelManagerTestCase(BaseTestCase):
    fixtures = ['test_data']

    def test_access_log_manager_only_gets_access_logs(self):
        user = User.objects.get(username='someuser')
        # non-access log
        AuditLog.objects.create(
            user=user,
            log_type=AuditType.DATA_EDITING,
            action=AuditAction.CREATE,
            object_id=12345,
        )
        access_log_1 = AccessLog.objects.create(
            user=user,
        )
        access_log_2 = AccessLog.objects.create(user=user)
        all_access_logs_query = AccessLog.objects.all()
        self.assertEqual(all_access_logs_query.count(), 2)
        self.assertEqual(all_access_logs_query.first().id, access_log_1.id)
        self.assertEqual(all_access_logs_query.last().id, access_log_2.id)

    def test_with_group_key_uses_id_for_non_submissions(self):
        user = User.objects.get(username='someuser')
        access_log = AccessLog.objects.create(user=user, metadata={'foo': 'bar'})
        # the group key is calculated when fetching from the db
        refetched = AccessLog.objects.with_group_key().get(pk=access_log.id)
        self.assertEqual(refetched.group_key, str(refetched.id))

    def test_with_group_key_uses_hour_plus_user_for_submissions(self):
        user = User.objects.get(username='someuser')
        jan_1_1_30_am = datetime.datetime.fromisoformat(
            '2024-01-01T01:30:25.123456+00:00'
        )
        access_log = AccessLog.objects.create(
            user=user,
            metadata={'auth_type': ACCESS_LOG_SUBMISSION_AUTH_TYPE},
            date_created=jan_1_1_30_am,
        )
        # group key should be date truncated to the hour followed by user uid
        expected_group_key = f'2024-01-01 01:00:00{user.extra_details.uid}'
        refetched = AccessLog.objects.with_group_key().get(pk=access_log.id)

        self.assertEqual(refetched.group_key, expected_group_key)

    def test_with_submissions_grouped_preserves_non_submissions(self):
        jan_1_1_30_am = datetime.datetime.fromisoformat(
            '2024-01-01T01:30:25.123456+00:00'
        )
        jan_1_1_45_am = datetime.datetime.fromisoformat(
            '2024-01-01T01:45:25.123456+00:00'
        )
        user = User.objects.get(username='someuser')
        AccessLog.objects.create(
            user=user,
            metadata={'auth_type': 'Token', 'identify_me': '1'},
            date_created=jan_1_1_30_am,
        )
        AccessLog.objects.create(
            user=user,
            metadata={'auth_type': 'Token', 'identify_me': '2'},
            date_created=jan_1_1_45_am,
        )
        # order by date created so we can use first() and last()
        results = AccessLog.objects.with_submissions_grouped().order_by('date_created')
        self.assertEqual(results.count(), 2)

        first_result = results.first()
        self.assertDictEqual(
            first_result['metadata'], {'auth_type': 'Token', 'identify_me': '1'}
        )
        self.assertEqual(first_result['date_created'], jan_1_1_30_am)

        second_result = results.last()
        self.assertDictEqual(
            second_result['metadata'],
            {'auth_type': 'Token', 'identify_me': '2'},
        )
        self.assertEqual(second_result['date_created'], jan_1_1_45_am)

    def test_with_submissions_grouped_groups_submissions(self):
        jan_1_1_30_am = datetime.datetime.fromisoformat(
            '2024-01-01T01:30:25.123456+00:00'
        )
        jan_1_1_45_am = datetime.datetime.fromisoformat(
            '2024-01-01T01:45:25.123456+00:00'
        )
        jan_1_2_15_am = datetime.datetime.fromisoformat(
            '2024-01-01T02:15:25.123456+00:00'
        )

        user1 = User.objects.get(username='someuser')
        user2 = User.objects.get(username='anotheruser')
        # two submissions for user1 between 1-2am
        AccessLog.objects.create(
            user=user1,
            metadata={'auth_type': ACCESS_LOG_SUBMISSION_AUTH_TYPE},
            date_created=jan_1_1_30_am,
        )
        AccessLog.objects.create(
            user=user1,
            metadata={'auth_type': ACCESS_LOG_SUBMISSION_AUTH_TYPE},
            date_created=jan_1_1_45_am,
        )
        # one submission for user1 after 2am
        AccessLog.objects.create(
            user=user1,
            metadata={'auth_type': ACCESS_LOG_SUBMISSION_AUTH_TYPE},
            date_created=jan_1_2_15_am,
        )
        # one submission for user2 between 1-2am
        AccessLog.objects.create(
            user=user2,
            metadata={'auth_type': ACCESS_LOG_SUBMISSION_AUTH_TYPE},
            date_created=jan_1_1_30_am,
        )

        # order by date created so we can use first() and last()
        results = AccessLog.objects.with_submissions_grouped().order_by('date_created')
        # should get 3 submission groups, 2 for user1, and 1 for user2
        self.assertEqual(results.count(), 3)

        user_1_groups = results.filter(user__username='someuser')
        self.assertEqual(user_1_groups.count(), 2)
        # first group should have 1/1/2024 1:30am as the date created
        user_1_group_1 = user_1_groups.first()
        self.assertEqual(user_1_group_1['date_created'], jan_1_1_30_am)
        self.assertEqual(
            user_1_group_1['metadata']['auth_type'],
            ACCESS_LOG_SUBMISSION_GROUP_AUTH_TYPE,
        )
        # second group should have 1/1/2024 2:15am as the date created
        user_1_group_2 = user_1_groups.last()
        self.assertEqual(user_1_group_2['date_created'], jan_1_2_15_am)
        self.assertEqual(
            user_1_group_2['metadata']['auth_type'],
            ACCESS_LOG_SUBMISSION_GROUP_AUTH_TYPE,
        )

        # one group for user2
        user_2_groups = results.filter(user__username='anotheruser')
        self.assertEqual(user_2_groups.count(), 1)
        user_2_group_1 = user_2_groups.first()
        self.assertEqual(user_2_group_1['count'], 1)
        self.assertEqual(
            user_2_group_1['metadata']['auth_type'],
            ACCESS_LOG_SUBMISSION_GROUP_AUTH_TYPE,
        )


@ddt
class ProjectHistoryLogModelTestCase(BaseAuditLogTestCase):

    fixtures = ['test_data']

    def _check_common_fields(self, log: ProjectHistoryLog, user, asset):
        self.assertEqual(log.user.id, user.id)
        self.assertEqual(log.app_label, 'kpi')
        self.assertEqual(log.model_name, 'asset')
        self.assertEqual(log.object_id, asset.id)
        self.assertEqual(log.user_uid, user.extra_details.uid)
        self.assertEqual(log.log_type, AuditType.PROJECT_HISTORY)

    def _create_request(self, asset_uid_key=None, url_name=None):
        factory = RequestFactory()
        request = factory.post('/')
        request.user = User.objects.get(username='someuser')
        if asset_uid_key or url_name:
            request.resolver_match = Mock()
            if asset_uid_key:
                request.resolver_match.kwargs = {asset_uid_key: 'a12345'}
            if url_name:
                request.resolver_match.url_name = url_name
        return request

    def test_create_project_history_log_sets_standard_fields(self):
        user = User.objects.get(username='someuser')
        asset = Asset.objects.get(pk=1)
        yesterday = timezone.now() - timedelta(days=1)
        log = ProjectHistoryLog.objects.create(
            user=user,
            metadata={
                'ip_address': '1.2.3.4',
                'source': 'source',
                'asset_uid': asset.uid,
                'log_subtype': 'project',
                'project_owner': asset.owner.username,
            },
            date_created=yesterday,
            object_id=asset.id,
        )
        self._check_common_fields(log, user, asset)
        self.assertEqual(log.date_created, yesterday)
        self.assertDictEqual(
            log.metadata,
            {
                'ip_address': '1.2.3.4',
                'source': 'source',
                'asset_uid': asset.uid,
                'log_subtype': 'project',
                'project_owner': asset.owner.username,
            },
        )

    @patch('kobo.apps.audit_log.models.logging.warning')
    def test_create_project_history_log_ignores_attempt_to_override_standard_fields(
        self, patched_warning
    ):
        user = User.objects.get(username='someuser')
        asset = Asset.objects.get(pk=1)
        log = ProjectHistoryLog.objects.create(
            log_type=AuditType.DATA_EDITING,
            model_name='foo',
            app_label='bar',
            object_id=asset.id,
            metadata={
                'ip_address': '1.2.3.4',
                'source': 'source',
                'asset_uid': asset.uid,
                'log_subtype': 'project',
                'project_owner': asset.owner.username,
            },
            user=user,
        )
        # the standard fields should be set the same as any other project history logs
        self._check_common_fields(log, user, asset)
        # we logged a warning for each attempt to override a field
        self.assertEqual(patched_warning.call_count, 3)

    @data(
        # source, asset_uid, ip_address, subtype
        ('source', 'a1234', None, 'project', 'someuser'),  # missing ip
        ('source', None, '1.2.3.4', 'project', 'someuser'),  # missing asset_uid
        (None, 'a1234', '1.2.3.4', 'project', 'someuser'),  # missing source
        ('source', 'a1234', '1.2.3.4', None, 'someuser'),  # missing subtype
        ('source', 'a1234', '1.2.3.4', 'bad_type', 'someuser'),  # bad subtype
        ('source', 'a1234', '1.2.3.4', 'project', None),  # missing owner
    )
    @unpack
    def test_create_project_history_log_requires_metadata_fields(
        self, source, ip_address, asset_uid, subtype, owner
    ):
        user = User.objects.get(username='someuser')
        asset = Asset.objects.get(pk=1)
        metadata = {
            'source': source,
            'ip_address': ip_address,
            'asset_uid': asset_uid,
            'log_subtype': subtype,
            'project_owner': owner,
        }

        with self.assertRaises(ValidationError):
            ProjectHistoryLog.objects.create(
                object_id=asset.id,
                metadata=metadata,
                user=user,
            )

        # remove key
        filtered = {k: v for k, v in metadata.items() if v is not None}
        with self.assertRaises(ValidationError):
            ProjectHistoryLog.objects.create(
                object_id=asset.id,
                metadata=filtered,
                user=user,
            )

    def test_create_from_related_request_object_created(self):
        request = self._create_request(asset_uid_key='parent_lookup_asset')
        # if an object has been created, only `updated_data` will be set
        request.updated_data = {
            'object_id': 1,
            'field_1': 'a',
            'field_2': 'b',
            'asset.owner.username': 'fred',
        }
        ProjectHistoryLog._related_request_base(
            request,
            label='fieldname',
            add_action=AuditAction.CREATE,
            delete_action=AuditAction.DELETE,
            modify_action=AuditAction.UPDATE,
        )
        log = ProjectHistoryLog.objects.first()
        self.assertEqual(log.action, AuditAction.CREATE)
        self.assertEqual(log.object_id, 1)
        # metadata should contain all additional fields that were stored in updated_data
        # under the given label
        self.assertDictEqual(
            log.metadata['fieldname'], {'field_1': 'a', 'field_2': 'b'}
        )
        self.assertEqual(log.metadata['asset_uid'], 'a12345')

    def test_create_from_related_request_object_deleted(self):
        request = self._create_request(asset_uid_key='parent_lookup_asset')
        # if an object has been created, only `initial_data` will be set
        request.initial_data = {
            'object_id': 1,
            'field_1': 'a',
            'field_2': 'b',
            'asset.owner.username': 'fred',
        }
        ProjectHistoryLog._related_request_base(
            request,
            label='label',
            add_action=AuditAction.CREATE,
            delete_action=AuditAction.DELETE,
            modify_action=AuditAction.UPDATE,
        )
        log = ProjectHistoryLog.objects.first()
        self.assertEqual(log.action, AuditAction.DELETE)
        self.assertEqual(log.object_id, 1)
        # metadata should contain all additional fields that were stored in updated_data
        # under the given label
        self.assertDictEqual(log.metadata['label'], {'field_1': 'a', 'field_2': 'b'})
        self.assertEqual(log.metadata['asset_uid'], 'a12345')

    def test_create_from_related_request_object_modified(self):
        request = self._create_request(asset_uid_key='parent_lookup_asset')
        # if an object has been modified, both `initial_data`
        # and `updated_data` should be filled
        request.initial_data = {
            'object_id': 1,
            'field_1': 'a',
            'field_2': 'b',
            'asset.owner.username': 'fred',
        }
        request.updated_data = {
            'object_id': 1,
            'field_1': 'new_field1',
            'field_2': 'new_field2',
            'asset.owner.username': 'fred',
        }
        ProjectHistoryLog._related_request_base(
            request,
            label='label',
            add_action=AuditAction.CREATE,
            delete_action=AuditAction.DELETE,
            modify_action=AuditAction.UPDATE,
        )
        log = ProjectHistoryLog.objects.first()
        self.assertEqual(log.action, AuditAction.UPDATE)
        self.assertEqual(log.object_id, 1)
        # we should use the updated data for the log
        self.assertDictEqual(
            log.metadata['label'], {'field_1': 'new_field1', 'field_2': 'new_field2'}
        )
        self.assertEqual(log.metadata['asset_uid'], 'a12345')

    def test_create_from_related_request_no_log_created_if_no_data(self):
        request = self._create_request(asset_uid_key='parent_lookup_asset')
        # no `initial_data` or `updated_data` present
        ProjectHistoryLog._related_request_base(
            request,
            label='label',
            add_action=AuditAction.CREATE,
            delete_action=AuditAction.DELETE,
            modify_action=AuditAction.UPDATE,
        )
        self.assertEqual(ProjectHistoryLog.objects.count(), 0)

    def test_create_from_import_task_no_name_change(self):
        asset = Asset.objects.get(pk=1)
        task = ImportTask.objects.create(
            user=User.objects.get(username='someuser'), data={}
        )
        task.messages = {
            'audit_logs': [
                {
                    'asset_uid': asset.uid,
                    'latest_version_uid': 'av12345',
                    'ip_address': '1.2.3.4',
                    'source': 'source',
                    'asset_id': asset.id,
                    'old_name': asset.name,
                    'new_name': asset.name,
                    'project_owner': asset.owner.username,
                }
            ]
        }
        ProjectHistoryLog.create_from_import_task(task)
        self.assertEqual(ProjectHistoryLog.objects.count(), 1)
        log = ProjectHistoryLog.objects.first()
        self.assertEqual(log.action, AuditAction.REPLACE_FORM)
        self.assertEqual(log.object_id, asset.id)

        # data from 'messages' should be copied to the log
        self.assertDictEqual(
            log.metadata,
            {
                'ip_address': '1.2.3.4',
                'asset_uid': asset.uid,
                'source': 'source',
                'latest_version_uid': 'av12345',
                'log_subtype': PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
                'project_owner': asset.owner.username,
            },
        )

    def test_create_from_import_task_with_name_change(self):
        asset = Asset.objects.get(pk=1)
        old_name = asset.name
        task = ImportTask.objects.create(
            user=User.objects.get(username='someuser'), data={}
        )
        task.messages = {
            'audit_logs': [
                {
                    'asset_uid': asset.uid,
                    'latest_version_uid': 'av12345',
                    'ip_address': '1.2.3.4',
                    'source': 'source',
                    'asset_id': asset.id,
                    'old_name': old_name,
                    'new_name': 'new_name',
                    'project_owner': asset.owner.username,
                }
            ]
        }
        ProjectHistoryLog.create_from_import_task(task)
        self.assertEqual(ProjectHistoryLog.objects.count(), 2)
        log = ProjectHistoryLog.objects.filter(action=AuditAction.REPLACE_FORM).first()
        self.assertEqual(log.object_id, asset.id)

        self.assertDictEqual(
            log.metadata,
            {
                'ip_address': '1.2.3.4',
                'asset_uid': asset.uid,
                'source': 'source',
                'latest_version_uid': 'av12345',
                'log_subtype': PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
                'project_owner': asset.owner.username,
            },
        )
        name_log = ProjectHistoryLog.objects.filter(
            action=AuditAction.UPDATE_NAME
        ).first()
        self.assertEqual(log.object_id, asset.id)

        self.assertDictEqual(
            name_log.metadata,
            {
                'ip_address': '1.2.3.4',
                'asset_uid': asset.uid,
                'source': 'source',
                'latest_version_uid': 'av12345',
                'log_subtype': PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
                'name': {'old': old_name, 'new': 'new_name'},
                'project_owner': asset.owner.username,
            },
        )

    def test_create_from_unexpected_anonymous_permissions(self):
        # Normal anonymous permissions tested elsewhere
        # This test is for if somehow other permissions are assigned
        request = self._create_request(asset_uid_key='parent_lookup_asset')
        request.updated_data = {'asset.id': 1, 'asset.owner.username': 'fred'}
        request.permissions_added = {
            # these permissions are not allowed for anonymous users,
            # pretend something went wrong/changed and they were assigned anyway
            'AnonymousUser': {'discover_asset', 'validate_submissions'}
        }
        ProjectHistoryLog._create_from_permissions_request(
            request,
        )
        self.assertEqual(ProjectHistoryLog.objects.count(), 1)
        log = ProjectHistoryLog.objects.first()
        self.assertEqual(log.object_id, 1)
        # should create a regular 'MODIFY_USER_PERMISSIONS' log
        self.assertEqual(log.action, AuditAction.MODIFY_USER_PERMISSIONS)
        permissions = log.metadata['permissions']
        self.assertEqual(permissions['username'], 'AnonymousUser')
        self.assertListEqual(
            permissions[PROJECT_HISTORY_LOG_METADATA_FIELD_REMOVED], []
        )
        self.assertListEqual(
            sorted(permissions[PROJECT_HISTORY_LOG_METADATA_FIELD_ADDED]),
            ['discover_asset', 'validate_submissions'],
        )

    @data(
        # only active changed, is_active, has_deployment, expected action
        (True, True, True, AuditAction.UNARCHIVE),
        (True, False, True, AuditAction.ARCHIVE),
        # we shouldn't be able to un/archive an undeployed asset,
        # but test for thoroughness
        (True, True, False, AuditAction.UNARCHIVE),
        (True, False, False, AuditAction.ARCHIVE),
        (False, True, True, AuditAction.REDEPLOY),
        (False, True, False, AuditAction.DEPLOY),
        (False, False, True, AuditAction.REDEPLOY),
        (False, False, False, AuditAction.DEPLOY),
    )
    @unpack
    def test_create_from_deployment_request(
        self, only_active_changed, is_active, has_deployment, expected_log_action
    ):
        request = self._create_request(asset_uid_key='uid')

        request.initial_data = {
            'id': 1,
            'has_deployment': has_deployment,
        }
        request.additional_audit_log_info = {
            'only_active_changed': only_active_changed,
            'active': is_active,
            'latest_version_uid': 'v12345',
            'latest_deployed_version_uid': 'v12345',
            'owner_username': 'someuser',
        }
        ProjectHistoryLog._create_from_deployment_request(request)
        log = ProjectHistoryLog.objects.first()
        self.assertEqual(log.action, expected_log_action)

    @data(
        # action, number of assets, expected number of logs
        (AuditAction.ARCHIVE, 2, 2),
        (AuditAction.UNARCHIVE, 2, 2),
        ('', 2, 0),
        (AuditAction.ARCHIVE, 0, 0),
        (AuditAction.UNARCHIVE, 0, 0),
        ('', 0, 0),
    )
    @unpack
    def test_create_from_bulk_request(self, action, asset_count, expected_log_count):
        assets = Asset.objects.all()[0:asset_count]
        for asset in assets:
            # save to create a version
            asset.save()
        request = self._create_request()
        request._data = {
            'payload': {
                'action': action,
                'asset_uids': [asset.uid for asset in assets],
            }
        }
        ProjectHistoryLog._create_from_bulk_request(request)
        logs = ProjectHistoryLog.objects.all()
        self.assertEqual(logs.count(), expected_log_count)
        for log in logs:
            self.assertEqual(log.action, action)

    def test_create_from_bulk_requests_exits_on_malformed_request(self):
        request = self._create_request()
        request._data = {}
        ProjectHistoryLog._create_from_bulk_request(request)
        self.assertEqual(ProjectHistoryLog.objects.count(), 0)

    @data(
        ('name', '_handle_name_change'),
        ('settings', '_handle_settings_change'),
        ('data_sharing', '_handle_sharing_change'),
        ('content', '_handle_content_change'),
        ('advanced_features.qual.qual_survey', '_handle_qa_change'),
    )
    @unpack
    def test_create_from_detail_request_plumbing(self, field, expected_method):
        request = self._create_request('uid')
        request.initial_data = {
            'id': 1,
            'name': 'name',
            'settings': 'settings',
            'data_sharing': 'sharing',
            'content': 'content',
            'advanced_features.qual.qual_survey': 'survey',
            'latest_version.uid': 'v12345',
            'owner.username': 'someuser',
        }
        request.updated_data = {**request.initial_data, field: 'new'}
        with patch(
            f'kobo.apps.audit_log.models.ProjectHistoryLog.{expected_method}',
            return_value=(AuditAction.UPDATE, {}),
        ) as patched:
            ProjectHistoryLog._create_from_detail_request(request)
        patched.assert_called_once()

    def test_unexpected_fields_ignored_in_detail_request(self):
        request = self._create_request('uid')
        request.initial_data = {
            'id': 1,
            'name': 'name',
            'settings': 'settings',
            'data_sharing': 'sharing',
            'content': 'content',
            'advanced_features.qual.qual_survey': 'survey',
            'latest_version.uid': 'v12345',
            'something_new': 'new',
            'owner.username': 'someuser',
        }
        request.updated_data = {**request.initial_data, 'something_new': 'i am new'}
        # no log should be created even though 'something_new' changed
        ProjectHistoryLog._create_from_detail_request(request)
        self.assertEqual(ProjectHistoryLog.objects.count(), 0)

    def test_submissions_with_unknown_action(self):
        request = self._create_request(url_name='submissions')
        request.asset = Asset.objects.get(id=1)
        update1 = SubmissionUpdate(
            id=1,
            action='weird action',
            root_uuid='s12345',
            username='username',
            status='',
        )
        request.instances = {1: update1}
        ProjectHistoryLog._create_from_submission_request(request)
        log = ProjectHistoryLog.objects.first()
        self.assertEqual(log.action, AuditAction.MODIFY_SUBMISSION)
