# coding: utf-8
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils.http import urlencode
from rest_framework import status
from trench.utils import get_mfa_model

from kpi.tests.kpi_test_case import KpiTestCase


class LoginTests(KpiTestCase):
    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')

        # Activate MFA for someuser
        get_mfa_model().objects.create(
            user=self.someuser,
            secret='dummy_mfa_secret',
            name='app',
            is_primary=True,
            is_active=True,
            _backup_codes='dummy_encoded_codes',
        )
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
        self.assertContains(response, "verification token")

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
        self.assertNotContains(response, "verification token")

        self.assertEqual(len(response.redirect_chain), 1)
        redirection, status_code = response.redirect_chain[0]
        self.assertEqual(status_code, status.HTTP_302_FOUND)
        self.assertEqual('/accounts/confirm-email/', redirection)

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
