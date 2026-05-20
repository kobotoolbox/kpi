# coding: utf-8
from allauth.account.models import EmailAddress
from constance.test import override_config
from django.conf import settings
from django.shortcuts import resolve_url
from django.template.response import TemplateResponse
from django.urls import reverse
from freezegun import freeze_time
from rest_framework import status

from kobo.apps.accounts.forms import LoginForm
from kobo.apps.accounts.mfa.tests.utils import activate_mfa_for_user
from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.kpi_test_case import KpiTestCase


@freeze_time('2026-01-01 12:00:00')
class TestStripeMFALogin(KpiTestCase):
    def setUp(self):
        self.someuser = User.objects.get(username='someuser')

        # Confirm someuser's e-mail address as primary and verified
        email_address, _ = EmailAddress.objects.get_or_create(user=self.someuser)
        email_address.primary = True
        email_address.verified = True
        email_address.save()

        # Activate MFA for someuser
        activate_mfa_for_user(self.client, self.someuser)
        # Ensure `self.client` is not authenticated
        self.client.logout()

    @override_config(MFA_ENABLED=True)
    def test_mfa_login_works_for_everyone(self):
        """
        Test that MFA form is displayed after login unconditionally for any user
        """
        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(reverse('kobo_login'), data=data)
        self.assertRedirects(response, reverse('mfa_authenticate'))

    @override_config(MFA_ENABLED=False)
    def test_mfa_globally_disabled(self):
        """
        Test that MFA form is bypassed if the feature is globally disabled
        """
        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(reverse('kobo_login'), data=data, follow=True)
        self.assertEqual(len(response.redirect_chain), 1)
        redirection, status_code = response.redirect_chain[0]
        self.assertEqual(status_code, status.HTTP_302_FOUND)
        self.assertEqual(resolve_url(settings.LOGIN_REDIRECT_URL), redirection)

    @override_config(MFA_ENABLED=True)
    def test_no_mfa_login_with_wrong_password(self):
        """
        Test if MFA by-pass does not create a hole and let the
        user log in with wrong credentials.
        """

        data = {
            'login': 'someuser',
            'password': 'badpassword',
        }
        response = self.client.post(reverse('kobo_login'), data=data, follow=True)
        self.assertEqual(len(response.redirect_chain), 0)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response, TemplateResponse)
        self.assertFalse(response.context_data['form'].is_valid())
        self.assertIsInstance(response.context_data['form'], LoginForm)
