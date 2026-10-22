import base64

import pyotp
from allauth.account.models import EmailAddress
from allauth.mfa.adapter import get_adapter
from allauth.mfa.models import Authenticator
from constance.test import override_config
from django.test import override_settings
from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.main.models import UserProfile
from kpi.tests.kpi_test_case import BaseTestCase
from ..utils import get_totp_authenticator, sync_mfa_profiles, user_has_active_mfa
from .utils import activate_mfa_for_user, get_mfa_code_for_user

HEADLESS_URL = '/api/v2/allauth/browser/v1'


@override_config(MFA_ENABLED=True)
@override_settings(ACCOUNT_RATE_LIMITS=False)
class HeadlessMfaTestCase(BaseTestCase):
    """
    MFA turned on or off through allauth's headless endpoints (used by the
    redesigned frontend) must be honoured everywhere in KPI, exactly like MFA
    turned on or off through KPI's `/api/v2/auth/app/...` endpoints
    """

    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self._verify_email(self.someuser)

    @staticmethod
    def _verify_email(user):
        EmailAddress.objects.update_or_create(
            user=user,
            email=user.email,
            defaults={'verified': True, 'primary': True},
        )

    def _login(self, username='someuser', password='someuser'):
        return self.client.post(
            f'{HEADLESS_URL}/auth/login',
            data={'username': username, 'password': password},
            content_type='application/json',
        )

    def _login_with_mfa(self, user, password):
        response = self._login(user.username, password)
        assert self._pending_flows(response) == ['mfa_authenticate']
        response = self.client.post(
            f'{HEADLESS_URL}/auth/2fa/authenticate',
            data={'code': get_mfa_code_for_user(user)},
            content_type='application/json',
        )
        assert response.status_code == status.HTTP_200_OK

    @staticmethod
    def _pending_flows(response):
        return [
            flow['id']
            for flow in response.json()['data'].get('flows', [])
            if flow.get('is_pending')
        ]

    def _assert_basic_auth_status(self, expected_status):
        self.client.logout()
        token = base64.b64encode(b'someuser:someuser').decode()
        response = self.client.get(
            '/api/v2/assets/',
            HTTP_AUTHORIZATION=f'Basic {token}',
        )
        assert response.status_code == expected_status

    def test_mfa_activated_with_headless_is_enforced(self):
        assert self._login().status_code == status.HTTP_200_OK
        response = self.client.get(f'{HEADLESS_URL}/account/authenticators/totp')
        secret = response.json()['meta']['secret']
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                f'{HEADLESS_URL}/account/authenticators/totp',
                data={'code': pyotp.TOTP(secret).now()},
                content_type='application/json',
            )
        assert response.status_code == status.HTTP_200_OK

        assert get_adapter().is_mfa_enabled(self.someuser)
        assert UserProfile.objects.get(user=self.someuser).is_mfa_active
        response = self.client.get(reverse('mfa_list_user_methods'))
        assert response.json()[0]['is_active'] is True

        # The next login asks for a code
        self.client.logout()
        assert self._pending_flows(self._login()) == ['mfa_authenticate']

        # Password-only API access is refused
        self._assert_basic_auth_status(status.HTTP_401_UNAUTHORIZED)

    def test_mfa_deactivated_with_headless_is_released(self):
        activate_mfa_for_user(self.client, self.someuser)
        assert UserProfile.objects.get(user=self.someuser).is_mfa_active
        self._login_with_mfa(self.someuser, 'someuser')

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(
                f'{HEADLESS_URL}/account/authenticators/totp'
            )
        assert response.status_code == status.HTTP_200_OK

        assert not user_has_active_mfa(self.someuser)
        assert not Authenticator.objects.filter(user=self.someuser).exists()
        assert not UserProfile.objects.get(user=self.someuser).is_mfa_active
        assert self.client.get(reverse('mfa_list_user_methods')).json() == []

        self._assert_basic_auth_status(status.HTTP_200_OK)

    def test_codes_regenerated_with_headless_are_accepted(self):
        activate_mfa_for_user(self.client, self.someuser)
        self._login_with_mfa(self.someuser, 'someuser')

        response = self.client.post(
            f'{HEADLESS_URL}/account/authenticators/recovery-codes',
            content_type='application/json',
        )
        assert response.status_code == status.HTTP_200_OK
        recovery_code = response.json()['data']['unused_codes'][0]

        # KPI's code validation finds the new recovery codes
        response = self.client.post(
            reverse('mfa-deactivate', args=('app',)), data={'code': recovery_code}
        )
        assert response.status_code == status.HTTP_200_OK
        assert not user_has_active_mfa(self.someuser)

    @override_config(SUPERUSER_AUTH_ENFORCEMENT=True)
    def test_superuser_cannot_deactivate_with_headless_when_enforced(self):
        superuser = User.objects.create_superuser(
            username='su', password='su', email='su@example.com'
        )
        self._verify_email(superuser)
        activate_mfa_for_user(self.client, superuser)
        self._login_with_mfa(superuser, 'su')

        response = self.client.delete(f'{HEADLESS_URL}/account/authenticators/totp')
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert get_totp_authenticator(superuser) is not None
        assert UserProfile.objects.get(user=superuser).is_mfa_active

    def test_sync_mfa_profiles(self):
        activate_mfa_for_user(self.client, self.someuser)
        anotheruser = User.objects.get(username='anotheruser')
        # Simulate profiles that drifted from the authenticators
        UserProfile.objects.filter(user=self.someuser).update(is_mfa_active=False)
        UserProfile.objects.update_or_create(
            user=anotheruser, defaults={'is_mfa_active': True}
        )

        assert sync_mfa_profiles() == (1, 1)
        assert UserProfile.objects.get(user=self.someuser).is_mfa_active
        assert not UserProfile.objects.get(user=anotheruser).is_mfa_active

        # A NULL column reads as False and must be switched on too
        UserProfile.objects.filter(user=self.someuser).update(is_mfa_active=None)
        assert not UserProfile.objects.get(user=self.someuser).is_mfa_active
        assert sync_mfa_profiles() == (1, 0)
        assert UserProfile.objects.get(user=self.someuser).is_mfa_active

    def test_deleting_user_with_mfa(self):
        """
        The profile sync on TOTP deletion must not recreate a profile for a
        user being deleted
        """
        activate_mfa_for_user(self.client, self.someuser)
        user_id = self.someuser.pk
        UserProfile.objects.filter(user_id=user_id).delete()

        self.someuser.delete()

        assert not Authenticator.objects.filter(user_id=user_id).exists()
        assert not UserProfile.objects.filter(user_id=user_id).exists()
