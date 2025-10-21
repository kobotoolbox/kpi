from allauth.account.models import EmailAddress
from allauth.mfa.adapter import get_adapter
from django.conf import settings
from django.shortcuts import resolve_url
from django.urls import reverse
from rest_framework import status
import pyotp

from kobo.apps.accounts.mfa.models import MfaMethodsWrapper
from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.kpi_test_case import KpiTestCase


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
        self.client.login(username='someuser', password='someuser')
        self.client.post(reverse('mfa-activate', kwargs={'method': 'app'}))
        mfa_method = MfaMethodsWrapper.objects.get(user=self.someuser, name='app')
        adapter = get_adapter()
        secret = adapter.decrypt(mfa_method.secret)
        totp = pyotp.TOTP(secret)
        code = totp.now()
        self.client.post(reverse('mfa-confirm', kwargs={'method': 'app'}), data={'code': str(code)})
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
        self.assertContains(response, 'verification token')

    def test_login_with_mfa_disabled(self):
        """
        Validate that multi-factor authentication form is NOT displayed after
        successful login
        """
        data = {
            'login': 'anotheruser',
            'password': 'anotheruser',
        }
        response = self.client.post(
            reverse('kobo_login'), data=data, follow=True
        )
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
