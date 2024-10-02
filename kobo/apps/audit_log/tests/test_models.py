from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import AnonymousUser
from django.test.client import RequestFactory
from django.urls import resolve, reverse
from django.utils import timezone

from kobo.apps.audit_log.models import (
    ACCESS_LOG_LOGINAS_AUTH_TYPE,
    ACCESS_LOG_UNKNOWN_AUTH_TYPE,
    AccessLog,
    AuditAction,
    AuditType,
)
from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.base_test_case import BaseTestCase


@patch(
    'kobo.apps.audit_log.models.get_human_readable_client_user_agent',
    return_value='source',
)
@patch('kobo.apps.audit_log.models.get_client_ip', return_value='127.0.0.1')
class AccessLogModelTestCase(BaseTestCase):

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

    def test_create_access_log_sets_standard_fields(self, patched_ip, patched_source):
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
        self, patched_warning, patched_ip, patched_source
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

    def test_basic_create_auth_log_from_request(
        self, patched_ip, patched_source
    ):
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

    def test_create_auth_log_from_loginas_request(
        self, patched_ip, patched_source
    ):
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

    def test_create_auth_log_with_different_auth_type(
        self, patched_ip, patched_source
    ):
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

    def test_create_auth_log_unknown_authenticator(
        self, patched_ip, patched_source
    ):
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

    def test_create_auth_log_with_extra_metadata(
        self, patched_ip, patched_source
    ):
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
