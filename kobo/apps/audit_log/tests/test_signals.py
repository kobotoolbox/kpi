from unittest.mock import patch

from allauth.account.models import (
    EmailAddress,
    EmailConfirmation,
    EmailConfirmationHMAC,
)
from django.contrib.auth import get_user_model
from django.urls import resolve, reverse

from kobo.apps.audit_log.models import AuditAction, AuditLog
from kpi.tests.base_test_case import BaseTestCase


class AuditLogTestCase(BaseTestCase):
    """
    Class for testing that logins produce AuditLogs.

    AuditLogs for more complicated login flows are tested as part of the tests for those flows to avoid
    copying lots of complicated setup.
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = get_user_model().objects.create_user(
            'user', 'user@example.com', 'pass'
        )
        cls.user.backend = 'django.contrib.auth.backends.ModelBackend'
        cls.user.save()

    @patch('kobo.apps.audit_log.signals.AuditLog.create_auth_log_from_request')
    def test_audit_log_created_on_login(self, patched_create):
        """
        Basic plumbing test to make sure the signal is hooked up
        """
        self.client.login(username='user', password='pass')
        patched_create.assert_called_once()

    def test_simple_login(self):
        count = AuditLog.objects.count()
        self.assertEqual(count, 0)
        user = AuditLogTestCase.user
        data = {
            'login': 'user',
            'password': 'pass',
        }
        with self.settings(ACCOUNT_EMAIL_VERIFICATION='none'):
            response = self.client.post(
                reverse('kobo_login'), data=data, follow=True
            )
        audit_log = AuditLog.objects.first()
        # AuditLogs are tested more fully elsewhere, just make sure one was created
        self.assertEqual(audit_log.user.id, user.id)
        self.assertEqual(audit_log.action, AuditAction.AUTH)

    def test_login_with_email_verification(self):
        user = AuditLogTestCase.user
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
