from allauth.account.models import EmailAddress
from constance.test import override_config
from django.conf import settings
from django.shortcuts import resolve_url
from django.urls import reverse
from freezegun import freeze_time
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.kpi_test_case import KpiTestCase
from .utils import activate_mfa_for_user

METHOD = 'app'


@freeze_time('2026-01-01 12:00:00')
class LoginTests(KpiTestCase):
    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')

        # Confirm users' e-mail addresses as primary and verified
        email_address, _ = EmailAddress.objects.get_or_create(user=self.someuser)
        email_address.primary = True
        email_address.verified = True
        email_address.save()

        email_address, _ = EmailAddress.objects.get_or_create(user=self.anotheruser)
        email_address.primary = True
        email_address.verified = True
        email_address.save()

        # Activate MFA for someuser
        activate_mfa_for_user(self.client, self.someuser)
        # Ensure `self.client` is not authenticated
        self.client.logout()

    def test_login_with_mfa_enabled(self):
        """
        Validate that multi-factor authentication form is displayed after
        successful login
        """
        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(reverse('kobo_login'), data=data)
        self.assertRedirects(response, reverse('mfa_authenticate'))

    def test_login_while_authenticated_as_other_user_still_enforces_mfa(self):
        """
        Regression: navigating somewhere that bounces to the login form (e.g.
        `/admin/`) while already logged in as a user without MFA, then
        submitting credentials for an MFA-enabled account, must present the
        2FA challenge instead of silently redirecting back to the landing page
        still logged in as the original user.
        """
        # `anotheruser` has no MFA enabled; authenticate as them first
        self.client.force_login(self.anotheruser)
        # Attempt to log in as `someuser` (MFA enabled) without logging out.
        # Follow the whole redirect chain: the bug is that the login POST
        # correctly redirects to `mfa_authenticate`, but that view then bounces
        # the still-authenticated `anotheruser` back to the landing page
        # without ever completing (or challenging) the `someuser` login.
        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(reverse('kobo_login'), data=data, follow=True)
        # The 2FA challenge must be reached and rendered, not skipped
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.request['PATH_INFO'], reverse('mfa_authenticate'))
        # The stale `anotheruser` session must not remain authenticated
        self.assertFalse(response.context['user'].is_authenticated)

    def test_failed_login_while_authenticated_keeps_existing_session(self):
        """
        A failed login attempt (wrong password) while already authenticated
        must not drop the existing session: the current user stays logged in.
        """
        self.client.force_login(self.anotheruser)
        data = {
            'login': 'someuser',
            'password': 'wrong-password',
        }
        response = self.client.post(reverse('kobo_login'), data=data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.context['user'].is_authenticated)
        self.assertEqual(response.context['user'].pk, self.anotheruser.pk)

    def test_relogin_as_same_mfa_user_keeps_session(self):
        """
        Re-submitting your own credentials while already authenticated must not
        drop the session: the guard only logs out a *different* user, so an
        MFA-enabled user re-logging in as themselves stays authenticated and
        lands on the usual redirect target (no spurious 2FA challenge, no
        lockout).
        """
        self.client.force_login(self.someuser)
        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(reverse('kobo_login'), data=data, follow=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.request['PATH_INFO'],
            resolve_url(settings.LOGIN_REDIRECT_URL),
        )
        self.assertTrue(response.context['user'].is_authenticated)
        self.assertEqual(response.context['user'].pk, self.someuser.pk)

    def test_switch_to_other_non_superuser_with_next_admin_is_not_redirected(self):
        """
        Regression: a non-superuser switching into another non-superuser
        account while `?next=/admin/` is in the POST must not be redirected to
        the admin panel (which would immediately bounce them with a permission
        error). The admin-redirect guard must key off the account being
        authenticated, not `request.user` — which allauth evaluates before the
        login completes, and which the stale-session logout sets to anonymous.
        """
        admin_url = reverse('admin:index')
        # Logged in as `someuser` (non-superuser); switch to `anotheruser`
        # (another non-superuser, no MFA) with `next=/admin/`
        self.client.force_login(self.someuser)
        data = {
            'login': 'anotheruser',
            'password': 'anotheruser',
            'next': admin_url,
        }
        response = self.client.post(reverse('kobo_login'), data=data, follow=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Must land on the normal redirect target, never the admin panel
        self.assertEqual(
            response.request['PATH_INFO'],
            resolve_url(settings.LOGIN_REDIRECT_URL),
        )
        self.assertNotEqual(response.request['PATH_INFO'], admin_url)
        self.assertEqual(response.context['user'].pk, self.anotheruser.pk)

    def test_superuser_with_next_admin_is_redirected_to_admin(self):
        """
        The admin-redirect guard must only suppress the redirect for
        non-superusers: a superuser logging in with `?next=/admin/` must still
        be sent to the admin panel.
        """
        admin_url = reverse('admin:index')
        self.anotheruser.is_staff = True
        self.anotheruser.is_superuser = True
        self.anotheruser.save()
        data = {
            'login': 'anotheruser',
            'password': 'anotheruser',
            'next': admin_url,
        }
        response = self.client.post(reverse('kobo_login'), data=data)
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertTrue(response.url.startswith(admin_url))

    @override_config(MFA_ENABLED=False)
    def test_mfa_globally_disabled(self):
        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(reverse('kobo_login'), data=data)
        self.assertRedirects(response, reverse(settings.LOGIN_REDIRECT_URL))

    def test_login_with_mfa_disabled(self):
        """
        Validate that multi-factor authentication form is NOT displayed after
        successful login
        """
        data = {
            'login': 'anotheruser',
            'password': 'anotheruser',
        }
        response = self.client.post(reverse('kobo_login'), data=data, follow=True)
        self.assertEqual(len(response.redirect_chain), 1)
        redirection, status_code = response.redirect_chain[0]
        self.assertEqual(status_code, status.HTTP_302_FOUND)
        self.assertEqual(resolve_url(settings.LOGIN_REDIRECT_URL), redirection)

    def test_admin_login(self):
        """
        Admin login is disabled and should redirect to normal login form
        with `?next=admin`
        """
        response = self.client.get(reverse('admin:login'), follow=True)
        self.assertEqual(len(response.redirect_chain), 1)
        redirection, status_code = response.redirect_chain[0]
        self.assertEqual(status_code, status.HTTP_302_FOUND)
        expected = f"{reverse('kobo_login')}?next={reverse('admin:login')}"
        self.assertEqual(expected, redirection)
