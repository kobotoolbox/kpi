import contextlib
from unittest.mock import Mock, patch

from allauth.account.models import EmailAddress
from constance.signals import config_updated
from ddt import data, ddt
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth.signals import user_logged_in
from django.test import RequestFactory, override_settings
from django.urls import reverse
from rest_framework import status
from freezegun import freeze_time

from kobo.apps.accounts.mfa.tests.utils import (
    activate_mfa_for_user,
    get_mfa_code_for_user,
)
from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog, AuditType
from kobo.apps.audit_log.signals import create_access_log
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization
from kpi.constants import (
    PERM_PARTIAL_SUBMISSIONS,
    PERM_VIEW_ASSET,
    PERM_VIEW_SUBMISSIONS,
)
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase
from kpi.tests.utils.transaction import immediate_on_commit
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE
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

    @freeze_time('2026-01-01 12:00:00')
    def test_mfa_login(self):
        user = AccessLogsSignalsTestCase.user
        activate_mfa_for_user(self.client, user)
        # Delete audit logs up to this point to start from scratch
        AuditLog.objects.all().delete()
        email_address, _ = EmailAddress.objects.get_or_create(user=user)
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

        code = get_mfa_code_for_user(user)
        self.client.post(reverse('mfa_authenticate'), {'code': code})
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

        # django-loginas triggers an AccessLog (AUTH) and a LogEntry (ADMIN_UPDATE)
        self.assertEqual(AuditLog.objects.count(), 2)
        audit_log = AuditLog.objects.get(action=AuditAction.AUTH)
        self.assertEqual(audit_log.user.id, new_user.id)
        self.assertEqual(audit_log.action, AuditAction.AUTH)

        # Verify that the ADMIN_UPDATE log was also created
        admin_update_log = AuditLog.objects.get(action=AuditAction.ADMIN_UPDATE)
        self.assertEqual(admin_update_log.user.id, AccessLogsSignalsTestCase.user.id)
        self.assertEqual(admin_update_log.action, AuditAction.ADMIN_UPDATE)


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
                        'codename': PERM_VIEW_SUBMISSIONS,
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


class TestAdminAuditLogIntegration(BaseTestCase):
    fixtures = ['test_data']
    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        super().setUp()
        self.url = reverse(self._get_endpoint('audit-log-list'))
        self.admin = User.objects.get(username='adminuser')
        self.someuser = User.objects.get(username='someuser')
        self.organization = Organization.objects.create(
            id='org999', name='Test Org for Audit', mmo_override=False
        )
        self.organization.add_user(self.someuser)
        self.client.force_login(self.admin)

    def test_admin_create_triggers_audit_log(self):
        """
        Tests that creating a new object via the Admin generates an ADMIN_CREATE log
        """
        url = reverse('admin:organizations_organization_add')

        payload = {
            'name': 'Brand New Organization',
            'mmo_override': 'on',
            'owner-TOTAL_FORMS': 0,
            'owner-INITIAL_FORMS': 0,
            'owner-MIN_NUM_FORMS': 0,
            'owner-MAX_NUM_FORMS': 1,
            'organization_users-TOTAL_FORMS': 0,
            'organization_users-INITIAL_FORMS': 0,
            'organization_users-MIN_NUM_FORMS': 0,
        }

        with immediate_on_commit():
            response = self.client.post(url, data=payload)

        self.assertEqual(response.status_code, 302)

        latest_log = AuditLog.objects.filter(
            action=AuditAction.ADMIN_CREATE,
            model_name='organization'
        ).latest('date_created')

        self.assertEqual(latest_log.user, self.admin)
        self.assertEqual(latest_log.log_type, AuditType.ADMIN_INTERFACE)
        self.assertIn('created organization', latest_log.metadata['message'].lower())
        self.assertIn('Brand New Organization', latest_log.metadata['message'])

        # Check that the log is returned in the API response
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        audit_log = response.data['results'][0]
        self.assertEqual(audit_log['log_type'], AuditType.ADMIN_INTERFACE)
        self.assertEqual(audit_log['action'], AuditAction.ADMIN_CREATE)

    def test_admin_update_triggers_audit_log(self):
        """
        Tests that submitting a change via the Admin generates an ADMIN_UPDATE log
        """
        url = reverse(
            'admin:organizations_organization_change',
            kwargs={'object_id': self.organization.id},
        )

        payload = {
            'name': 'Updated Test Org Name',
            'mmo_override': 'on',
            'owner-0-id': self.organization.owner.id,
            'owner-0-organization': self.organization.id,
            'owner-TOTAL_FORMS': 1,
            'owner-INITIAL_FORMS': 1,
            'owner-MIN_NUM_FORMS': 0,
            'owner-MAX_NUM_FORMS': 1,
            'organization_users-TOTAL_FORMS': 0,
            'organization_users-INITIAL_FORMS': 0,
            'organization_users-MIN_NUM_FORMS': 0,
        }

        with immediate_on_commit():
            response = self.client.post(url, data=payload)

        self.assertEqual(response.status_code, 302)

        latest_log = AuditLog.objects.filter(
            action=AuditAction.ADMIN_UPDATE,
            object_id=self.organization.id
        ).latest('date_created')

        self.assertEqual(latest_log.user, self.admin)
        self.assertEqual(latest_log.model_name, 'organization')
        self.assertIn(
            "adminuser updated organization 'Updated Test Org Name' (pk: org999)",
            latest_log.metadata['message']
        )
        self.assertIn(
            'Changed Name and Make organization multi-member (necessary for adding users)',  # noqa: E501
            latest_log.metadata['message']
        )

        # Check that the log is returned in the API response
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        audit_log = response.data['results'][0]
        self.assertEqual(audit_log['log_type'], AuditType.ADMIN_INTERFACE)
        self.assertEqual(audit_log['action'], AuditAction.ADMIN_UPDATE)

    def test_admin_delete_triggers_audit_log(self):
        """
        Tests that deleting an object via the Admin generates an ADMIN_DELETE log
        """
        url = reverse(
            'admin:organizations_organization_delete',
            kwargs={'object_id': self.organization.id},
        )

        # To bypass the admin "Are you sure?" confirmation page,
        # we need to pass a POST request with the "post" parameter set to "yes"
        payload = {'post': 'yes'}

        with immediate_on_commit():
            response = self.client.post(url, data=payload)

        self.assertEqual(response.status_code, 302)
        self.assertFalse(Organization.objects.filter(id=self.organization.id).exists())

        latest_log = AuditLog.objects.filter(
            action=AuditAction.ADMIN_DELETE,
            object_id=self.organization.id
        ).latest('date_created')

        self.assertEqual(latest_log.user, self.admin)
        self.assertEqual(latest_log.model_name, 'organization')
        self.assertIn(
            "adminuser deleted organization 'Test Org for Audit' (pk: org999)",
            latest_log.metadata['message']
        )

        # Check that the log is returned in the API response
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        audit_log = response.data['results'][0]
        self.assertEqual(audit_log['log_type'], AuditType.ADMIN_INTERFACE)
        self.assertEqual(audit_log['action'], AuditAction.ADMIN_DELETE)


class TestConstanceAuditLogSignal(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        super().setUp()
        self.admin = User.objects.get(username='adminuser')

    @patch('kobo.apps.audit_log.signals.get_current_request')
    def test_constance_update_triggers_audit_log(self, mock_get_request):
        """
        Tests that firing the Constance config_updated signal successfully
        generates an AuditLog entry with the correct user context and model naming
        """
        # Mock the request to simulate the admin user context
        mock_request = Mock()
        mock_request.user = self.admin
        mock_get_request.return_value = mock_request

        initial_count = AuditLog.objects.filter(
            action=AuditAction.UPDATE_CONSTANCE
        ).count()

        # Fire the Constance signal directly
        config_updated.send(
            sender=None,
            key='SUPPORT_EMAIL',
            old_value='old@example.com',
            new_value='new@example.com'
        )

        # Assert the AuditLog was created
        self.assertEqual(
            AuditLog.objects.filter(action=AuditAction.UPDATE_CONSTANCE).count(),
            initial_count + 1
        )

        # Verify the AuditLog data integrity
        latest_log = AuditLog.objects.filter(
            action=AuditAction.UPDATE_CONSTANCE
        ).latest('date_created')

        self.assertEqual(latest_log.user, self.admin)
        self.assertEqual(latest_log.log_type, AuditType.ADMIN_INTERFACE)
        self.assertEqual(latest_log.app_label, 'constance')
        self.assertEqual(latest_log.model_name, 'constance')
        self.assertEqual(latest_log.object_id, 'SUPPORT_EMAIL')

        # Verify Metadata parsing
        expected_message = (
            f'{self.admin.username} updated config key "SUPPORT_EMAIL" from '
            f'"old@example.com" to "new@example.com"'
        )
        self.assertEqual(latest_log.metadata['message'], expected_message)
        self.assertEqual(latest_log.metadata['old_value'], 'old@example.com')
        self.assertEqual(latest_log.metadata['new_value'], 'new@example.com')

    @patch('kobo.apps.audit_log.signals.get_current_request')
    def test_constance_update_ignored_without_request(self, mock_get_request):
        """
        Tests that programmatic config updates (no web request) are ignored safely
        """
        mock_get_request.return_value = None
        initial_count = AuditLog.objects.filter(
            action=AuditAction.UPDATE_CONSTANCE
        ).count()

        config_updated.send(
            sender=None,
            key='SUPPORT_EMAIL',
            old_value='old@example.com',
            new_value='new@example.com'
        )

        self.assertEqual(
            AuditLog.objects.filter(action=AuditAction.UPDATE_CONSTANCE).count(),
            initial_count
        )

    @patch('kobo.apps.audit_log.signals.get_current_request')
    def test_constance_update_ignored_unauthenticated_user(self, mock_get_request):
        """
        Tests that config updates by unauthenticated/anonymous users are ignored
        """
        mock_request = Mock()
        mock_request.user = AnonymousUser()
        mock_get_request.return_value = mock_request

        initial_count = AuditLog.objects.filter(
            action=AuditAction.UPDATE_CONSTANCE
        ).count()

        config_updated.send(
            sender=None,
            key='SUPPORT_EMAIL',
            old_value='old@example.com',
            new_value='new@example.com'
        )

        self.assertEqual(
            AuditLog.objects.filter(action=AuditAction.UPDATE_CONSTANCE).count(),
            initial_count
        )
