from unittest.mock import patch

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
)
from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.base_test_case import BaseTestCase


@patch(
    'kobo.apps.audit_log.models.get_human_readable_client_user_agent',
    return_value='source',
)
@patch('kobo.apps.audit_log.models.get_client_ip', return_value='127.0.0.1')
class AuditLogModelTestCase(BaseTestCase):

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

    def _check_common_fields(self, audit_log: AuditLog, user):
        self.assertEqual(audit_log.user.id, user.id)
        self.assertEqual(audit_log.app_label, ACCESS_LOG_KOBO_AUTH_APP_LABEL)
        self.assertEqual(audit_log.model_name, 'User')
        self.assertEqual(audit_log.object_id, user.id)
        self.assertEqual(audit_log.user_uid, user.extra_details.uid)
        self.assertEqual(audit_log.action, AuditAction.AUTH)
        self.assertEqual(audit_log.log_type, AuditType.ACCESS)

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
        second_user = User.objects.create_user(
            'second_user', 'second@example.com', 'pass'
        )
        second_user.save()
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
        second_user = User.objects.create_user(
            'second_user', 'second@example.com', 'pass'
        )
        second_user.save()
        request = self._create_request(
            reverse('api_v2:asset-list'),
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
                'auth_type': ACCESS_LOG_UNKNOWN_AUTH_TYPE,
            },
        )
