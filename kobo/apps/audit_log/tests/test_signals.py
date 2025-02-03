import contextlib
from unittest.mock import patch

from allauth.account.models import EmailAddress
from ddt import data, ddt
from django.contrib.auth.signals import user_logged_in
from django.test import RequestFactory, override_settings
from django.urls import reverse
from trench.utils import get_mfa_model

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog
from kobo.apps.audit_log.signals import create_access_log
from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import (
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase
from kpi.utils.object_permission import (
    post_assign_partial_perm,
    post_assign_perm,
    post_remove_partial_perms,
    post_remove_perm,
)


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


class AccessLogsSignalsTestCase(BaseTestCase):
    """
    Class for testing that logins produce AccessLogs.

    Here we just test that AccessLogs are produced, not necessarily what they contain.
    More tests for what they contain are in test_models.py. Also, AccessLogs for SSO
    logins are tested as part of the SSO tests to avoid copying lots of
    complicated setup.
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = User.objects.create_user('user', 'user@example.com', 'pass')
        cls.user.backend = 'django.contrib.auth.backends.ModelBackend'
        cls.user.save()

    @patch('kobo.apps.audit_log.signals.AccessLog.create_from_request')
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
        user = AccessLogsSignalsTestCase.user
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
        user = AccessLogsSignalsTestCase.user
        data = {
            'login': 'user',
            'password': 'pass',
        }
        self.client.post(reverse('kobo_login'), data=data, follow=True)
        # no audit log should be created yet because the email has not been verified
        self.assertEqual(AuditLog.objects.count(), 0)
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
            user=AccessLogsSignalsTestCase.user,
            secret='dummy_mfa_secret',
            name='app',
            is_primary=True,
            is_active=True,
            _backup_codes='dummy_encoded_codes',
        )
        mfa_object.save()
        email_address, _ = EmailAddress.objects.get_or_create(
            user=AccessLogsSignalsTestCase.user
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
            return_value=AccessLogsSignalsTestCase.user,
        ):
            self.client.post(
                reverse('mfa_token'),
                data={'code': '123456', 'ephemeral_token': 'dummy'},
                follow=True,
            )
        self.assertEqual(AuditLog.objects.count(), 1)
        audit_log = AuditLog.objects.first()
        self.assertEqual(audit_log.user.id, AccessLogsSignalsTestCase.user.id)
        self.assertEqual(audit_log.action, AuditAction.AUTH)

    def test_loginas(self):
        AccessLogsSignalsTestCase.user.is_superuser = True
        AccessLogsSignalsTestCase.user.save()
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


@ddt
class ProjectHistoryLogsSignalsTestCase(BaseTestCase):

    fixtures = ['test_data']

    def setUp(self):
        super().setUp()
        self.wsgi_request = RequestFactory().post('/')
        self.asset = Asset.objects.get(pk=1)
        # 'someuser' owns the asset, so use 'anotheruser' for testing perm assignments
        self.user = User.objects.get(username='anotheruser')
        request_patcher = patch(
            'kobo.apps.audit_log.signals.get_current_request',
            return_value=self.wsgi_request,
        )

        request_patcher.start()
        self.addCleanup(request_patcher.stop)

    @data(
        post_assign_perm,
        post_remove_perm,
        post_assign_partial_perm,
        post_remove_partial_perms,
    )
    def test_receivers_add_necessary_fields_to_request(self, signal):
        # use all possible parameters for each signal
        # so we can re-use the test
        signal.send(
            sender=Asset,
            instance=self.asset,
            user=self.user,
            codename=PERM_PARTIAL_SUBMISSIONS,
            perms={PERM_VIEW_ASSET: [{'_submitted_by': 'someuser'}]},
            deny=False,
        )
        self.assertTrue(hasattr(self.wsgi_request, 'permissions_added'))
        self.assertTrue(hasattr(self.wsgi_request, 'permissions_removed'))
        self.assertTrue(hasattr(self.wsgi_request, 'partial_permissions_added'))

    def test_add_permission(self):
        self.asset.assign_perm(self.user, PERM_VIEW_ASSET)
        self.assertDictEqual(
            self.wsgi_request.permissions_added, {'anotheruser': {PERM_VIEW_ASSET}}
        )

    def test_remove_permission(self):
        self.asset.assign_perm(self.user, PERM_VIEW_ASSET)
        self.asset.remove_perm(self.user, PERM_VIEW_ASSET)
        self.assertDictEqual(
            self.wsgi_request.permissions_removed, {'anotheruser': {PERM_VIEW_ASSET}}
        )

    def test_add_partial_permission(self):
        self.asset.assign_perm(
            self.user,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms={PERM_VIEW_SUBMISSIONS: [{'_submitted_by': 'someuser'}]},
        )
        self.assertDictEqual(
            self.wsgi_request.partial_permissions_added,
            {
                'anotheruser': [
                    {
                        'code': PERM_VIEW_SUBMISSIONS,
                        'filters': [{'_submitted_by': 'someuser'}],
                    }
                ]
            },
        )

    def test_remove_partial_permission(self):
        self.asset.assign_perm(
            self.user,
            PERM_PARTIAL_SUBMISSIONS,
            partial_perms={PERM_VIEW_SUBMISSIONS: [{'_submitted_by': 'someuser'}]},
        )
        self.asset.remove_perm(self.user, PERM_PARTIAL_SUBMISSIONS)
        self.assertDictEqual(
            self.wsgi_request.partial_permissions_added, {'anotheruser': []}
        )
        self.assertDictEqual(
            self.wsgi_request.permissions_removed,
            {'anotheruser': {PERM_PARTIAL_SUBMISSIONS}},
        )

    def test_deny_permission(self):
        self.asset.assign_perm(self.user, PERM_VIEW_ASSET, deny=True)
        # nothing added since the permission was denied
        self.assertDictEqual(self.wsgi_request.partial_permissions_added, {})
