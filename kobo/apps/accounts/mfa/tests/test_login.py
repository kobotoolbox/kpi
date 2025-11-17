from allauth.account.models import EmailAddress
from constance.test import override_config
from django.conf import settings
from django.shortcuts import resolve_url
from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.kpi_test_case import KpiTestCase
from .utils import activate_mfa_for_user

METHOD = 'app'


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
