import datetime
from datetime import timedelta
from unittest.mock import patch

from ddt import data, ddt, unpack
from django.contrib.auth.models import AnonymousUser
from django.test.client import RequestFactory
from django.urls import resolve, reverse
from django.utils import timezone
from model_bakery import baker

from kobo.apps.audit_log.models import (
    ACCESS_LOG_LOGINAS_AUTH_TYPE,
    ACCESS_LOG_UNKNOWN_AUTH_TYPE,
    AccessLog,
    AuditAction,
    AuditLog,
    AuditType,
    ProjectHistoryLog,
)
from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import (
    ASSET_TYPE_QUESTION,
    ACCESS_LOG_SUBMISSION_AUTH_TYPE,
    ACCESS_LOG_SUBMISSION_GROUP_AUTH_TYPE,
    PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
)
from kpi.exceptions import BadAssetTypeException
from kpi.models import Asset
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
        self.assertEquals(log.date_created, yesterday)
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
        self.assertEquals(patched_warning.call_count, 4)

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

    def test_create_project_history_log_sets_standard_fields(self):
        user = User.objects.get(username='someuser')
        asset = Asset.objects.get(pk=1)
        yesterday = timezone.now() - timedelta(days=1)
        log = ProjectHistoryLog.objects.create(
            user=user,
            metadata={'foo': 'bar'},
            date_created=yesterday,
            asset=asset,
        )
        self._check_common_fields(log, user, asset)
        self.assertEquals(log.date_created, yesterday)
        self.assertDictEqual(log.metadata, {'foo': 'bar'})

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
            asset=asset,
            user=user,
        )
        # the standard fields should be set the same as any other project history logs
        self._check_common_fields(log, user, asset)
        # we logged a warning for each attempt to override a field
        self.assertEquals(patched_warning.call_count, 3)

    def test_cannot_create_project_history_log_from_non_survey_asset(self):
        block_asset = baker.make(Asset)
        block_asset.asset_type = ASSET_TYPE_QUESTION
        with self.assertRaises(BadAssetTypeException):
            ProjectHistoryLog.objects.create(
                user=User.objects.get(username='someuser'), asset=block_asset
            )

    @data(
        # first_deployment, only_active_changed, is_active,
        # expected_action, expect_extra_metadata
        (True, False, True, AuditAction.DEPLOY, True),
        (False, False, True, AuditAction.REDEPLOY, True),
        (False, True, False, AuditAction.ARCHIVE, False),
        (False, True, True, AuditAction.UNARCHIVE, False),
    )
    @unpack
    def test_create_log_for_deployment_changes(
        self,
        first_deployment,
        only_active_changed,
        is_active,
        expected_action,
        expect_extra_metadata,
    ):
        user = User.objects.get(username='someuser')
        factory = RequestFactory()
        request = factory.post('')
        request.user = user
        asset = Asset.objects.get(pk=1)
        asset.save()
        asset.deploy(backend='mock', active=is_active)
        log = ProjectHistoryLog.create_from_deployment_request(
            request,
            asset,
            first_deployment=first_deployment,
            only_active_changed=only_active_changed,
        )
        self._check_common_fields(log, user, asset)
        expected_metadata = {
            'ip_address': '127.0.0.1',
            'source': 'source',
            'asset_uid': asset.uid,
            'log_subtype': PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
        }
        if expect_extra_metadata:
            expected_metadata.update(
                {
                    'version_uid': asset.latest_deployed_version_uid,
                }
            )
        self.assertDictEqual(log.metadata, expected_metadata)
        self.assertEqual(log.action, expected_action)
