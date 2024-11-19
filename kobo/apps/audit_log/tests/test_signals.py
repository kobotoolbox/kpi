import contextlib
from unittest.mock import patch

from allauth.account.models import EmailAddress
from django.contrib.auth.signals import user_logged_in
from django.test import override_settings
from django.urls import reverse
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory
from trench.utils import get_mfa_model

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog
from kobo.apps.audit_log.signals import create_access_log
from kobo.apps.kobo_auth.shortcuts import User
from kpi.models import Asset
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

    fixtures = ['test_data']

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


class ProjectHistoryLogPermissionsSignalsTestCase(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        super().setUp()

        self.factory = APIRequestFactory()
        self.drf_request = Request(
            self.factory.post(
                reverse(
                    'api_v2:asset-permission-assignment-bulk-assignments',
                    kwargs={'parent_lookup_asset': Asset.objects.get(pk=1)},
                ),
                data={},
            )
        )
        self.asset = Asset.objects.get(pk=1)

    def test_add_permission(self):
        user = User.objects.get(username='admin')
        anotheruser = User.objects.get(username='anotheruser')

        self.asset.assign_perm(
            user_obj=user, perm='view_asset', request=self.drf_request
        )
        # first permission added for admin user
        self.assertDictEqual(
            self.drf_request._request.permissions_added, {'admin': ['view_asset']}
        )

        # second permission added for admin user
        self.asset.assign_perm(
            user_obj=user, perm='add_submissions', request=self.drf_request
        )
        self.assertDictEqual(
            self.drf_request._request.permissions_added,
            {'admin': ['view_asset', 'add_submissions']},
        )

        # first permission added for anotheruser
        self.asset.assign_perm(
            user_obj=anotheruser, perm='view_asset', request=self.drf_request
        )
        self.assertDictEqual(
            self.drf_request._request.permissions_added,
            {
                'admin': ['view_asset', 'add_submissions'],
                'anotheruser': ['view_asset'],
            },
        )

    def test_remove_permission(self):
        user = User.objects.get(username='admin')
        anotheruser = User.objects.get(username='anotheruser')
        self.asset.assign_perm(user_obj=user, perm='view_asset')
        self.asset.assign_perm(user_obj=user, perm='add_submissions')
        self.asset.assign_perm(user_obj=anotheruser, perm='view_asset')

        # first permission removed for admin user
        self.asset.remove_perm(
            user_obj=user, perm='view_asset', request=self.drf_request
        )
        self.assertDictEqual(
            self.drf_request._request.permissions_removed, {'admin': ['view_asset']}
        )

        # second permission removed for admin user
        self.asset.remove_perm(
            user_obj=user, perm='add_submissions', request=self.drf_request
        )
        self.assertDictEqual(
            self.drf_request._request.permissions_removed,
            {'admin': ['view_asset', 'add_submissions']},
        )

        # first permission removed for anotheruser
        self.asset.remove_perm(
            user_obj=anotheruser, perm='view_asset', request=self.drf_request
        )
        self.assertDictEqual(
            self.drf_request._request.permissions_removed,
            {
                'admin': ['view_asset', 'add_submissions'],
                'anotheruser': ['view_asset'],
            },
        )

    def test_add_partial_permissions(self):
        user = User.objects.get(username='admin')
        anotheruser = User.objects.get(username='anotheruser')

        partial_perms = {
            'view_submissions': [
                {'_submitted_by': 'someuser'},
            ],
        }

        # add partial permission for admin user
        self.asset._update_partial_permissions(
            user=user,
            perm='partial_submissions',
            partial_perms=partial_perms,
            request=self.drf_request,
        )
        self.assertDictEqual(
            self.drf_request._request.permissions_added,
            {
                'admin': [
                    {
                        'code': 'view_submissions',
                        'filters': [{'_submitted_by': 'someuser'}],
                    }
                ]
            },
        )

        # add partial permissions for anotheruser
        self.asset._update_partial_permissions(
            user=anotheruser,
            perm='partial_submissions',
            partial_perms=partial_perms,
            request=self.drf_request,
        )
        self.assertDictEqual(
            self.drf_request._request.permissions_added,
            {
                'admin': [
                    {
                        'code': 'view_submissions',
                        'filters': [{'_submitted_by': 'someuser'}],
                    }
                ],
                'anotheruser': [
                    {
                        'code': 'view_submissions',
                        'filters': [{'_submitted_by': 'someuser'}],
                    }
                ],
            },
        )

    def test_remove_partial_permissions(self):
        # the same request may add and remove partial permissions if, for example,
        # a bulk request contains two different entries granting partial permissions
        # to a user, the second will override the first
        user = User.objects.get(username='admin')

        partial_perms = {
            'view_submissions': [
                {'_submitted_by': 'someuser'},
            ],
        }

        # add partial permission
        self.asset._update_partial_permissions(
            user=user,
            perm='partial_submissions',
            partial_perms=partial_perms,
            request=self.drf_request,
        )
        self.asset.assign_perm(
            user_obj=user, perm='change_asset', request=self.drf_request
        )
        self.assertDictEqual(
            self.drf_request._request.permissions_added,
            {
                'admin': [
                    {
                        'code': 'view_submissions',
                        'filters': [{'_submitted_by': 'someuser'}],
                    },
                    'change_asset',
                ]
            },
        )

        # remove all partial permissions (cannot be done individually)
        self.asset._update_partial_permissions(
            user=user, perm='partial_submissions', remove=True, request=self.drf_request
        )
        # 'change_asset' remains, but old partial permissions removed
        self.assertDictEqual(
            self.drf_request._request.permissions_added, {'admin': ['change_asset']}
        )
