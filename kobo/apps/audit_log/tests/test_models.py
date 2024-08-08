from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test.client import RequestFactory
from django.urls import resolve

from kobo.apps.audit_log.models import (
    KOBO_AUTH_APP_LABEL,
    LOGINAS_AUTH_TYPE,
    UNKNOWN_AUTH_TYPE,
    AuditAction,
    AuditLog,
)
from kpi.tests.base_test_case import BaseTestCase


@patch('kobo.apps.audit_log.models.get_human_readable_client_user_agent', return_value='source')
@patch('kobo.apps.audit_log.models.get_client_ip', return_value='127.0.0.1')
class AuditLogTestCase(BaseTestCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.super_user = get_user_model().objects.create_user(
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
        self.assertEqual(audit_log.app_label, KOBO_AUTH_APP_LABEL)
        self.assertEqual(audit_log.model_name, 'User')
        self.assertEqual(audit_log.object_id, user.id)
        self.assertEqual(audit_log.user_uid, user.extra_details.uid)
        self.assertEqual(audit_log.action, AuditAction.AUTH)

    def test_basic_create_auth_log_from_request(self, patched_ip, patched_source):
        request = self._create_request(
            '/accounts/login/', AnonymousUser(), AuditLogTestCase.super_user
        )
        log: AuditLog = AuditLog.create_access_log_for_request(request)
        self._check_common_fields(log, AuditLogTestCase.super_user)
        self.assertDictEqual(
            log.metadata,
            {
                'ip_address': '127.0.0.1',
                'source': 'source',
                'auth_type': AuditLogTestCase.super_user.backend,
            },
        )

    def test_create_auth_log_from_loginas_request(self, patched_ip, patched_source):
        second_user = get_user_model().objects.create_user(
            'second_user', 'second@example.com', 'pass'
        )
        second_user.save()
        request = self._create_request(
            f'/admin/login/user/{second_user.id}/',
            AuditLogTestCase.super_user,
            second_user,
        )
        log: AuditLog = AuditLog.create_access_log_for_request(request)
        self._check_common_fields(log, second_user)
        self.assertDictEqual(
            log.metadata,
            {
                'ip_address': '127.0.0.1',
                'source': 'source',
                'auth_type': LOGINAS_AUTH_TYPE,
                'initial_user_uid': AuditLogTestCase.super_user.extra_details.uid,
                'initial_user_username': AuditLogTestCase.super_user.username,
            },
        )

    def test_create_auth_log_with_different_auth_type(self, patched_ip, patched_source):
        request = self._create_request(
            '/api/v2/assets/', AnonymousUser(), AuditLogTestCase.super_user
        )
        log: AuditLog = AuditLog.create_access_log_for_request(
            request, authentication_type='Token'
        )
        self._check_common_fields(log, AuditLogTestCase.super_user)
        self.assertDictEqual(
            log.metadata,
            {
                'ip_address': '127.0.0.1',
                'source': 'source',
                'auth_type': 'Token',
            },
        )

    def test_create_auth_log_unknown_authenticator(self, patched_ip, patched_source):
        # no backend attached to the user object
        second_user = get_user_model().objects.create_user(
            'second_user', 'second@example.com', 'pass'
        )
        second_user.save()
        request = self._create_request(
            f'/api/v2/assets/', AuditLogTestCase.super_user, second_user
        )
        log: AuditLog = AuditLog.create_access_log_for_request(request)
        self._check_common_fields(log, second_user)
        self.assertDictEqual(
            log.metadata,
            {
                'ip_address': '127.0.0.1',
                'source': 'source',
                'auth_type': UNKNOWN_AUTH_TYPE,
            },
        )
