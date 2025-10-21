from allauth.mfa.adapter import get_adapter
from constance.test import override_config
from django.urls import reverse
from rest_framework import status
import pyotp

from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.kpi_test_case import BaseTestCase
from ..models import MfaAvailableToUser, MfaMethodsWrapper
from .utils import get_mfa_code_for_user


class MfaApiTestCase(BaseTestCase):

    fixtures = ['test_data']

    """
    The purpose of this class is to cover the MFA API actions
    """

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')

        # Activate MFA for someuser
        self.client.login(username='someuser', password='someuser')
        activate_response = self.client.post(reverse('mfa-activate', kwargs={'method': 'app'}))
        code = get_mfa_code_for_user(self.someuser)
        confirm_response = self.client.post(reverse('mfa-confirm', kwargs={'method': 'app'}), data={'code': str(code)})

    def test_user_methods_with_date(self):

        response = self.client.get(reverse('mfa_list_user_methods'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json()
        expected_fields = [
            'date_created',
            'date_modified',
            'date_disabled'
        ]
        for field in expected_fields:
            self.assertTrue(field in results[0])

    @override_config(MFA_ENABLED=True)
    def test_mfa_activation_always_creates_new_secret(self):
        self.client.login(username='anotheruser', password='anotheruser')
        method = 'app'
        first_response = self.client.post(
            reverse('mfa-activate', args=(method,))
        )
        first_secret = (
            MfaMethodsWrapper
            .objects.get(user__username='anotheruser', name=method)
            .secret
        )

        self.client.post(
            reverse('mfa-deactivate', args=(method,))
        )

        second_response = self.client.post(
            reverse('mfa-activate', args=(method,))
        )
        second_secret = (
            MfaMethodsWrapper
            .objects.get(user__username='anotheruser', name=method)
            .secret
        )
        assert first_secret != second_secret
        assert first_response.json() != second_response.json()

    @override_config(MFA_ENABLED=True)
    def test_mfa_whitelisting(self):
        method = 'app'
        anotheruser = User.objects.get(username='anotheruser')
        self.client.login(username='anotheruser', password='anotheruser')

       # Test when whitelist is disabled
        activate_response = self.client.post(
            reverse('mfa-activate', args=(method,))
        )
        assert activate_response.status_code == status.HTTP_200_OK

        # Enable the MFA whitelist by adding a user
        someuser_mfa_activation = MfaAvailableToUser.objects.create(
            user=self.someuser
        )

        activate_response = self.client.post(
            reverse('mfa-activate', args=(method,))
        )
        assert activate_response.status_code == status.HTTP_403_FORBIDDEN

        mfa_availability = MfaAvailableToUser.objects.create(user=anotheruser)
        activate_response = self.client.post(
            reverse('mfa-activate', args=(method,))
        )
        assert activate_response.status_code == status.HTTP_200_OK

        # Reset MFA whitelist state
        mfa_availability.delete()
        someuser_mfa_activation.delete()

    def test_regenerate_codes(self):
        response = self.client.post(reverse('mfa-regenerate', args=('app',)))
        assert len(response.data['backup_codes']) == 6
