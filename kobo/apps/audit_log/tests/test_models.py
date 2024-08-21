from datetime import datetime
from unittest.mock import patch

from ddt import data, ddt, unpack
from django.contrib.auth.models import AnonymousUser
from django.test.client import RequestFactory
from django.urls import resolve, reverse

from kobo.apps.audit_log.models import (
    ACCESS_LOG_KOBO_AUTH_APP_LABEL,
    ACCESS_LOG_LOGINAS_AUTH_TYPE,
    ACCESS_LOG_UNKNOWN_AUTH_TYPE,
    AuditAction,
    AuditLog,
    AuditType,
    SubmissionGroup,
)
from kobo.apps.audit_log.tests.test_utils import (
    create_submission_access_log,
    create_submission_group_log,
    skip_submission_group_creation,
)
from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import (
    ACCESS_LOG_AUTH_TYPE_KEY,
    SUBMISSION_GROUP_AUTH_TYPE,
    SUBMISSION_GROUP_COUNT_KEY,
    SUBMISSION_GROUP_LATEST_KEY,
)
from kpi.tests.base_test_case import BaseTestCase


class BaseAuditLogTestCase(BaseTestCase):

    fixtures = ['test_data']

    def _check_common_fields(self, audit_log: AuditLog, user):
        self.assertEqual(audit_log.user.id, user.id)
        self.assertEqual(audit_log.app_label, ACCESS_LOG_KOBO_AUTH_APP_LABEL)
        self.assertEqual(audit_log.model_name, 'User')
        self.assertEqual(audit_log.object_id, user.id)
        self.assertEqual(audit_log.user_uid, user.extra_details.uid)
        self.assertEqual(audit_log.action, AuditAction.AUTH)
        self.assertEqual(audit_log.log_type, AuditType.ACCESS)


@patch(
    'kobo.apps.audit_log.models.get_human_readable_client_user_agent',
    return_value='source',
)
@patch('kobo.apps.audit_log.models.get_client_ip', return_value='127.0.0.1')
class AuditLogModelTestCase(BaseAuditLogTestCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.super_user = User.objects.get(username='admin')
        cls.super_user.backend = 'django.contrib.auth.backends.ModelBackend'

    def _create_request(self, url: str, cached_user, new_user):
        factory = RequestFactory()
        request = factory.post(url)
        request.user = new_user
        request._cached_user = cached_user
        request.resolver_match = resolve(url)
        return request

    def test_basic_create_auth_log_from_request(
        self, patched_ip, patched_source
    ):
        request = self._create_request(
            reverse('kobo_login'),
            AnonymousUser(),
            AuditLogModelTestCase.super_user,
        )
        log: AuditLog = AuditLog.create_access_log_for_request(request)
        self._check_common_fields(log, AuditLogModelTestCase.super_user)
        self.assertDictEqual(
            log.metadata,
            {
                'ip_address': '127.0.0.1',
                'source': 'source',
                'auth_type': AuditLogModelTestCase.super_user.backend,
            },
        )

    def test_create_auth_log_from_loginas_request(
        self, patched_ip, patched_source
    ):
        second_user = User.objects.get(username='someuser')
        request = self._create_request(
            reverse('loginas-user-login', args=(second_user.id,)),
            AuditLogModelTestCase.super_user,
            second_user,
        )
        log: AuditLog = AuditLog.create_access_log_for_request(request)
        self._check_common_fields(log, second_user)
        self.assertDictEqual(
            log.metadata,
            {
                'ip_address': '127.0.0.1',
                'source': 'source',
                'auth_type': ACCESS_LOG_LOGINAS_AUTH_TYPE,
                'initial_user_uid': AuditLogModelTestCase.super_user.extra_details.uid,
                'initial_user_username': AuditLogModelTestCase.super_user.username,
            },
        )

    def test_create_auth_log_with_different_auth_type(
        self, patched_ip, patched_source
    ):
        request = self._create_request(
            reverse('api_v2:asset-list'),
            AnonymousUser(),
            AuditLogModelTestCase.super_user,
        )
        log: AuditLog = AuditLog.create_access_log_for_request(
            request, authentication_type='Token'
        )
        self._check_common_fields(log, AuditLogModelTestCase.super_user)
        self.assertDictEqual(
            log.metadata,
            {
                'ip_address': '127.0.0.1',
                'source': 'source',
                'auth_type': 'Token',
            },
        )

    def test_create_auth_log_unknown_authenticator(
        self, patched_ip, patched_source
    ):
        # no backend attached to the user object
        some_user = User.objects.get(username='someuser')
        some_user.save()
        request = self._create_request(
            reverse('api_v2:asset-list'),
            AnonymousUser(),
            some_user,
        )
        log: AuditLog = AuditLog.create_access_log_for_request(request)
        self._check_common_fields(log, some_user)
        self.assertDictEqual(
            log.metadata,
            {
                'ip_address': '127.0.0.1',
                'source': 'source',
                'auth_type': ACCESS_LOG_UNKNOWN_AUTH_TYPE,
            },
        )


class SubmissionAccessLogTestCase(BaseAuditLogTestCase):

    def test_create_submission_group_log(self):
        user = User.objects.get(username='someuser')
        access_log = create_submission_access_log(user)

        with skip_submission_group_creation():
            # we want to test calling the method manually
            access_log.save()
        group_log = access_log.create_new_group_log()
        self.assertTrue(isinstance(group_log, SubmissionGroup))
        self._check_common_fields(group_log, user)
        self.assertDictEqual(
            group_log.metadata,
            {
                ACCESS_LOG_AUTH_TYPE_KEY: SUBMISSION_GROUP_AUTH_TYPE,
                SUBMISSION_GROUP_COUNT_KEY: 1,
                SUBMISSION_GROUP_LATEST_KEY: access_log.date_created,
            },
        )

    def test_add_submission_to_group(self):
        user = User.objects.get(username='someuser')
        group_access_log = create_submission_group_log(
            user, count=3, latest_date='2024-01-01 00:00:00+00:00'
        )
        submission_access_log = create_submission_access_log(user)
        jan_2_midnight = datetime.fromisoformat('2024-01-02 00:00:00+00:00')
        submission_access_log.date_created = jan_2_midnight
        group_access_log.add_submission_to_group(submission_access_log)
        self.assertEqual(
            group_access_log.metadata[SUBMISSION_GROUP_COUNT_KEY], 4
        )
        self.assertEqual(
            group_access_log.metadata[SUBMISSION_GROUP_LATEST_KEY],
            jan_2_midnight,
        )

    @patch('kobo.apps.audit_log.models.logging.error')
    def test_add_cannot_add_submission_to_group_with_wrong_user(self, patched_error):
        user = User.objects.get(username='admin')
        user2 = User.objects.get(username='someuser')
        jan_1_midnight = datetime.fromisoformat('2024-01-01 00:00:00+00:00')
        group_access_log = create_submission_group_log(
            user, count=1, latest_date=jan_1_midnight
        )
        # submission log has a different user than group log
        submission_access_log = create_submission_access_log(user2)
        group_access_log.add_submission_to_group(submission_access_log)
        # count and latest date should be unchanged
        self.assertEqual(
            group_access_log.metadata[SUBMISSION_GROUP_COUNT_KEY], 1
        )
        self.assertEqual(
            group_access_log.metadata[SUBMISSION_GROUP_LATEST_KEY],
            jan_1_midnight,
        )
        # make sure we logged an error
        patched_error.assert_called_once()
