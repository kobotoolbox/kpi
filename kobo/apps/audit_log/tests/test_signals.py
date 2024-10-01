import contextlib
from unittest.mock import patch

from allauth.account.models import EmailAddress
from django.contrib.auth.signals import user_logged_in
from django.test import override_settings
from django.urls import resolve, reverse
from trench.utils import get_mfa_model

from kobo.apps.audit_log.models import AuditAction, AuditLog
from kobo.apps.audit_log.signals import create_access_log
from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.base_test_case import BaseTestCase


@contextlib.contextmanager
def skip_login_access_log():
    """
    Context manager for skipping the creation of an access log on login

    Disconnects the method that creates access logs from the user_logged_in signal within the contextmanager block.
    Useful when you want full control over the audit logs produced in a test.
    """
    user_logged_in.disconnect(create_access_log)
    yield
    user_logged_in.connect(create_access_log)


class AuditLogSignalsTestCase(BaseTestCase):
    """
    Class for testing that logins produce AuditLogs.

    Here we just test that AuditLogs are produced, not necessarily what they contain. More tests for what they contain
    are in test_models.py. Also, AuditLogs for SSO logins are tested as part of the SSO tests
    to avoid copying lots of complicated setup.
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = User.objects.create_user('user', 'user@example.com', 'pass')
        cls.user.backend = 'django.contrib.auth.backends.ModelBackend'
        cls.user.save()

    @patch('kobo.apps.audit_log.signals.AuditLog.create_access_log_for_request')
    def test_audit_log_created_on_login(self, patched_create):
        """
        Basic plumbing test to make sure the signal is hooked up
        """
        self.client.login(username='user', password='pass')
        patched_create.assert_called_once()

    @override_settings(ACCOUNT_EMAIL_VERIFICATION='none')
    def test_simple_login(self):
        count = AuditLog.objects.count()
        self.assertEqual(count, 0)
        user = AuditLogSignalsTestCase.user
        data = {
            'login': 'user',
            'password': 'pass',
        }
        response = self.client.post(
            reverse('kobo_login'), data=data, follow=True
        )
        audit_log = AuditLog.objects.first()
        # AuditLogs are tested more fully elsewhere, just make sure one was created
        self.assertEqual(audit_log.user.id, user.id)
        self.assertEqual(audit_log.action, AuditAction.AUTH)

    def test_login_with_email_verification(self):
        user = AuditLogSignalsTestCase.user
        data = {
            'login': 'user',
            'password': 'pass',
        }
        self.client.post(reverse('kobo_login'), data=data, follow=True)
        # no audit log should be created yet because the email has not been verified
        self.assertEquals(AuditLog.objects.count(), 0)
        # verify the email and try again
        email: EmailAddress = EmailAddress.objects.filter(user=user).first()
        email.verified = True
        email.save()
        self.client.post(reverse('kobo_login'), data=data, follow=True)
        audit_log = AuditLog.objects.first()
        self.assertEqual(audit_log.user.id, user.id)
        self.assertEqual(audit_log.action, AuditAction.AUTH)

    def test_mfa_login(self):
        mfa_object = get_mfa_model().objects.create(
            user=AuditLogSignalsTestCase.user,
            secret='dummy_mfa_secret',
            name='app',
            is_primary=True,
            is_active=True,
            _backup_codes='dummy_encoded_codes',
        )
        mfa_object.save()
        email_address, _ = EmailAddress.objects.get_or_create(
            user=AuditLogSignalsTestCase.user
        )
        email_address.primary = True
        email_address.verified = True
        email_address.save()
        data = {
            'login': 'user',
            'password': 'pass',
        }
        self.client.post(reverse('kobo_login'), data=data, follow=True)
        # no audit log should be created yet because the MFA code hasn't been entered
        self.assertEqual(AuditLog.objects.count(), 0)

        with patch(
            'kobo.apps.accounts.mfa.forms.authenticate_second_step_command',
            return_value=AuditLogSignalsTestCase.user,
        ):
            self.client.post(
                reverse('mfa_token'),
                data={'code': '123456', 'ephemeral_token': 'dummy'},
                follow=True,
            )
        self.assertEqual(AuditLog.objects.count(), 1)
        audit_log = AuditLog.objects.first()
        self.assertEqual(audit_log.user.id, AuditLogSignalsTestCase.user.id)
        self.assertEqual(audit_log.action, AuditAction.AUTH)

    def test_loginas(self):
        AuditLogSignalsTestCase.user.is_superuser = True
        AuditLogSignalsTestCase.user.save()
        new_user = User.objects.create_user(
            'user2', 'user2@example.com', 'pass2'
        )
        new_user.save()
        with skip_login_access_log():
            self.client.login(username='user', password='pass')
        self.client.post(reverse('loginas-user-login', args=[new_user.id]))
        self.assertEqual(AuditLog.objects.count(), 1)
        audit_log = AuditLog.objects.first()
        self.assertEqual(audit_log.user.id, new_user.id)
        self.assertEqual(audit_log.action, AuditAction.AUTH)
