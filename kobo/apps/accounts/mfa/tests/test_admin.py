from allauth.mfa.models import Authenticator
from constance.test import override_config
from django.contrib.admin.sites import site
from django.contrib.messages.storage.fallback import FallbackStorage
from django.contrib.sessions.middleware import SessionMiddleware
from django.test.client import RequestFactory
from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.main.models import UserProfile
from kpi.tests.kpi_test_case import BaseTestCase
from ..admin import MfaAuthenticatorAdmin
from ..utils import get_totp_authenticator
from .utils import activate_mfa_for_user, get_pending_mfa_code


class MfaAdminTestCase(BaseTestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.admin_user = User.objects.create_superuser(
            username='admin', password='admin'
        )
        activate_mfa_for_user(self.client, self.someuser)
        self.model_admin = MfaAuthenticatorAdmin(Authenticator, site)
        self.request = self._build_request()

    def _build_request(self):
        request = RequestFactory().post('/')
        request.user = self.admin_user

        SessionMiddleware(lambda req: None).process_request(request)
        request.session.save()
        setattr(request, '_messages', FallbackStorage(request))
        return request

    def test_lists_totp_authenticators_only(self):
        queryset = self.model_admin.get_queryset(self.request)
        self.assertEqual(list(queryset), [get_totp_authenticator(self.someuser)])

    def test_admin_deactivation_cleans_up_authenticators(self):
        totp = get_totp_authenticator(self.someuser)
        self.assertTrue(self.model_admin.has_delete_permission(self.request, totp))

        self.assertTrue(UserProfile.objects.get(user=self.someuser).is_mfa_active)

        with self.captureOnCommitCallbacks(execute=True):
            self.model_admin.delete_model(self.request, totp)

        profile = UserProfile.objects.get(user=self.someuser)
        self.assertEqual(Authenticator.objects.filter(user=self.someuser).count(), 0)
        self.assertFalse(profile.is_mfa_active)

        # The user can turn MFA on again
        self.client.force_login(self.someuser)
        self.client.post(reverse('mfa-activate', kwargs={'method': 'app'}))
        confirm_response = self.client.post(
            reverse('mfa-confirm', kwargs={'method': 'app'}),
            data={'code': str(get_pending_mfa_code(self.client))},
        )

        self.assertEqual(confirm_response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(get_totp_authenticator(self.someuser))

    def test_bulk_deactivation(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.model_admin.delete_queryset(
                self.request, self.model_admin.get_queryset(self.request)
            )
        self.assertEqual(Authenticator.objects.filter(user=self.someuser).count(), 0)
        self.assertFalse(UserProfile.objects.get(user=self.someuser).is_mfa_active)

    @override_config(SUPERUSER_AUTH_ENFORCEMENT=True)
    def test_superuser_deactivation_blocked_when_enforced(self):
        superuser = User.objects.create_superuser(
            username='su', password='su', email='su@example.com'
        )
        activate_mfa_for_user(self.client, superuser)
        totp = get_totp_authenticator(superuser)

        self.assertFalse(self.model_admin.has_delete_permission(self.request, totp))

        self.model_admin.delete_queryset(
            self.request, self.model_admin.get_queryset(self.request)
        )
        # `someuser` is deactivated, the superuser is skipped
        self.assertIsNone(get_totp_authenticator(self.someuser))
        self.assertIsNotNone(get_totp_authenticator(superuser))


class MfaAdminViewsTestCase(BaseTestCase):
    """
    Same as `MfaAdminTestCase`, through the admin pages a superuser uses
    """

    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        activate_mfa_for_user(self.client, self.someuser)
        self.admin_user = User.objects.create_superuser(
            username='admin', password='admin', email='admin@example.com'
        )
        # Otherwise the admin is restricted until they change their password
        UserProfile.set_password_details(self.admin_user.pk, validated=True)
        self.client.force_login(self.admin_user)
        self.totp = get_totp_authenticator(self.someuser)

    def test_changelist_lists_users_with_mfa(self):
        response = self.client.get(reverse('admin:mfa_authenticator_changelist'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, 'someuser')

    def test_change_page_offers_delete(self):
        url = reverse('admin:mfa_authenticator_change', args=(self.totp.pk,))
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(
            response,
            reverse('admin:mfa_authenticator_delete', args=(self.totp.pk,)),
        )

    def test_delete_page_deactivates_mfa(self):
        self.assertTrue(UserProfile.objects.get(user=self.someuser).is_mfa_active)
        url = reverse('admin:mfa_authenticator_delete', args=(self.totp.pk,))
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(url, data={'post': 'yes'})
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertEqual(Authenticator.objects.filter(user=self.someuser).count(), 0)
        self.assertFalse(UserProfile.objects.get(user=self.someuser).is_mfa_active)

    def test_bulk_delete_action_deactivates_mfa(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse('admin:mfa_authenticator_changelist'),
                data={
                    'action': 'delete_selected',
                    '_selected_action': [self.totp.pk],
                    'post': 'yes',
                },
            )
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertEqual(Authenticator.objects.filter(user=self.someuser).count(), 0)
        self.assertFalse(UserProfile.objects.get(user=self.someuser).is_mfa_active)

    @override_config(SUPERUSER_AUTH_ENFORCEMENT=True)
    def test_superuser_mfa_cannot_be_deleted_when_enforced(self):
        activate_mfa_for_user(self.client, self.admin_user)
        self.client.force_login(self.admin_user)
        totp = get_totp_authenticator(self.admin_user)

        url = reverse('admin:mfa_authenticator_delete', args=(totp.pk,))
        response = self.client.post(url, data={'post': 'yes'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIsNotNone(get_totp_authenticator(self.admin_user))
