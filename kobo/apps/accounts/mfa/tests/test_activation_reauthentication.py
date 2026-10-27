import time
from unittest.mock import patch

import pyotp
from allauth.account.authentication import get_authentication_records
from allauth.account.models import EmailAddress
from allauth.mfa.models import Authenticator
from constance.test import override_config
from django.conf import settings
from django.test import TestCase, override_settings
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from ...tests.utils import record_authentication

TOTP_URL = '/api/v2/allauth/browser/v1/account/authenticators/totp'
RECOVERY_CODES_URL = (
    '/api/v2/allauth/browser/v1/account/authenticators/recovery-codes'
)


@override_config(MFA_ENABLED=True)
@override_settings(ACCOUNT_RATE_LIMITS=False)
class TotpActivationReauthenticationTestCase(TestCase):
    """
    Confirming a TOTP code while turning MFA on counts as a fresh MFA
    authentication, so the recovery codes can be shown right after without
    asking the user to re-authenticate with the code they just entered
    """

    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        EmailAddress.objects.update_or_create(
            user=self.user,
            email=self.user.email,
            defaults={'verified': True, 'primary': True},
        )
        self.client.force_login(self.user)

    def test_sso_only_user_gets_recovery_codes_after_activating_totp(self):
        self.user.set_unusable_password()
        self.user.save()
        self.client.force_login(self.user)
        # Signed in with SSO long before turning MFA on
        record_authentication(self.client, methods=('socialaccount',), age=600)

        assert self._activate_totp().status_code == status.HTTP_200_OK

        response = self._get_recovery_codes()
        assert response.status_code == status.HTTP_200_OK
        assert response.json()['data']['unused_codes']

    def test_password_user_gets_recovery_codes_after_slow_activation(self):
        # Re-authenticated with a password just inside the timeout...
        timeout = settings.ACCOUNT_REAUTHENTICATION_TIMEOUT
        record_authentication(self.client, age=timeout - 10)
        assert self._activate_totp().status_code == status.HTTP_200_OK

        # ... and the timeout runs out before the recovery codes are fetched
        with patch('time.time', return_value=time.time() + 20):
            response = self._get_recovery_codes()
        assert response.status_code == status.HTTP_200_OK

    def test_activation_still_requires_recent_reauthentication(self):
        record_authentication(self.client, age=600)

        response = self._activate_totp()

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert not Authenticator.objects.filter(user=self.user).exists()
        assert [
            record['method'] for record in get_authentication_records(self.client)
        ] == ['password']

    def test_failed_activation_is_not_recorded(self):
        record_authentication(self.client)
        self.client.get(TOTP_URL)

        response = self.client.post(
            TOTP_URL, data={'code': 'invalid'}, content_type='application/json'
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert [
            record['method'] for record in get_authentication_records(self.client)
        ] == ['password']

    def _activate_totp(self):
        response = self.client.get(TOTP_URL)
        assert response.status_code == status.HTTP_404_NOT_FOUND
        code = pyotp.TOTP(response.json()['meta']['secret']).now()
        return self.client.post(
            TOTP_URL, data={'code': code}, content_type='application/json'
        )

    def _get_recovery_codes(self):
        return self.client.get(RECOVERY_CODES_URL)
