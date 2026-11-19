from unittest.mock import patch

from allauth.account.models import EmailAddress
from allauth.core import context
from allauth.headless.constants import Client
from allauth.mfa import signals
from allauth.mfa.models import Authenticator
from allauth.mfa.recovery_codes.internal.auth import RecoveryCodes
from constance.test import override_config
from ddt import data, ddt
from django.contrib.auth.hashers import check_password
from django.core.cache import cache
from django.test import RequestFactory, SimpleTestCase, override_settings
from django.urls import Resolver404, resolve, reverse
from rest_framework import status

from kobo.apps.accounts.views import (
    HeadlessManageRecoveryCodesView,
    HeadlessManageTOTPView,
    HeadlessMfaAuthenticateView,
    HeadlessMfaReauthenticateView,
)
from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.kpi_test_case import BaseTestCase
from ..serializers import MfaCodeSerializer
from ..utils import MFA_METHOD_NAME
from .utils import (
    activate_mfa_for_user,
    get_mfa_code_for_user,
    set_legacy_recovery_codes,
)

HEADLESS_URL = '/api/v2/allauth/browser/v1'
HEADLESS_APP_URL = '/api/v2/allauth/app/v1'
LEGACY_CODES = ['legacy-code-1', 'legacy-code-2']


@ddt
@override_config(MFA_ENABLED=True)
@override_settings(ACCOUNT_RATE_LIMITS=False)
class HeadlessLegacyRecoveryCodesTestCase(BaseTestCase):
    """
    Recovery codes migrated from the former 2FA system are stored hashed, which
    allauth's own code check cannot compare. The headless 2FA screens must
    accept them like the templated pages do
    """

    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        EmailAddress.objects.update_or_create(
            user=self.someuser,
            email=self.someuser.email,
            defaults={'verified': True, 'primary': True},
        )
        activate_mfa_for_user(self.client, self.someuser)
        set_legacy_recovery_codes(self.someuser, LEGACY_CODES)

    def _post(self, url, payload=None):
        return self.client.post(
            f'{HEADLESS_URL}/{url}', data=payload or {}, content_type='application/json'
        )

    def _start_login(self):
        response = self._post(
            'auth/login', {'username': 'someuser', 'password': 'someuser'}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert [
            flow['id']
            for flow in response.json()['data']['flows']
            if flow.get('is_pending')
        ] == ['mfa_authenticate']

    def _login(self):
        self._start_login()
        response = self._post(
            'auth/2fa/authenticate', {'code': get_mfa_code_for_user(self.someuser)}
        )
        assert response.status_code == status.HTTP_200_OK

    @staticmethod
    def _error_codes(response):
        return [error['code'] for error in response.json()['errors']]

    def _legacy_codes_as_stored(self):
        recovery_codes = Authenticator.objects.get(
            user=self.someuser, type=Authenticator.Type.RECOVERY_CODES
        )
        return RecoveryCodes(recovery_codes)._get_migrated_codes()

    def _unused_legacy_code_count(self):
        return len(self._legacy_codes_as_stored())

    def test_login_accepts_legacy_recovery_code(self):
        self._start_login()

        response = self._post('auth/2fa/authenticate', {'code': LEGACY_CODES[0]})

        assert response.status_code == status.HTTP_200_OK
        assert response.json()['meta']['is_authenticated'] is True

    def test_login_spends_the_legacy_recovery_code(self):
        self._start_login()
        self._post('auth/2fa/authenticate', {'code': LEGACY_CODES[0]})
        assert self._unused_legacy_code_count() == 1
        self.client.logout()

        self._start_login()
        response = self._post('auth/2fa/authenticate', {'code': LEGACY_CODES[0]})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert self._error_codes(response) == ['incorrect_code']

    @data('auth/2fa/authenticate', 'auth/2fa/reauthenticate')
    def test_wrong_code_is_rejected(self, url):
        if url == 'auth/2fa/reauthenticate':
            self._login()
        else:
            self._start_login()

        response = self._post(url, {'code': 'not-a-code'})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert self._error_codes(response) == ['incorrect_code']
        assert self._unused_legacy_code_count() == 2

    def test_stored_value_is_not_accepted_as_a_code(self):
        stored_value = self._legacy_codes_as_stored()[0]
        self._start_login()

        response = self._post('auth/2fa/authenticate', {'code': stored_value})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert self._unused_legacy_code_count() == 2

    def test_wrong_code_is_reported_as_a_failed_authentication(self):
        received = []

        def receiver(sender, **kwargs):
            received.append(kwargs['authenticator'].type)

        signals.authentication_failed.connect(receiver)
        self.addCleanup(signals.authentication_failed.disconnect, receiver)
        self._start_login()

        self._post('auth/2fa/authenticate', {'code': 'not-a-code'})

        assert received == [Authenticator.Type.TOTP]

    def test_reauthentication_accepts_legacy_recovery_code(self):
        self._login()

        response = self._post('auth/2fa/reauthenticate', {'code': LEGACY_CODES[1]})

        assert response.status_code == status.HTTP_200_OK
        assert self._unused_legacy_code_count() == 1

    def test_recovery_codes_can_be_regenerated_after_legacy_reauthentication(self):
        self._login()
        self._post('auth/2fa/reauthenticate', {'code': LEGACY_CODES[0]})

        response = self._post('account/authenticators/recovery-codes')

        assert response.status_code == status.HTTP_200_OK
        # The new codes are allauth's own, and the legacy ones are gone
        recovery_codes = Authenticator.objects.get(
            user=self.someuser, type=Authenticator.Type.RECOVERY_CODES
        )
        assert 'migrated_codes' not in recovery_codes.data
        response = self._post('auth/2fa/reauthenticate', {'code': LEGACY_CODES[1]})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_legacy_recovery_codes_are_counted_but_not_shown(self):
        # Only hashes are stored, which must not be shown as if they were codes
        self._login()
        self._post('auth/2fa/reauthenticate', {'code': LEGACY_CODES[0]})

        response = self.client.get(
            f'{HEADLESS_URL}/account/authenticators/recovery-codes'
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()['data']['unused_code_count'] == 1
        assert 'unused_codes' not in response.json()['data']

    def test_allauth_recovery_codes_are_still_shown(self):
        Authenticator.objects.filter(
            user=self.someuser, type=Authenticator.Type.RECOVERY_CODES
        ).delete()
        codes = RecoveryCodes.activate(self.someuser).get_unused_codes()
        self._login()
        # With the password: the TOTP code used to log in cannot be used again
        self._post('auth/reauthenticate', {'password': 'someuser'})

        response = self.client.get(
            f'{HEADLESS_URL}/account/authenticators/recovery-codes'
        )

        assert response.json()['data']['unused_codes'] == codes

    def test_old_login_page_accepts_legacy_recovery_code(self):
        # The headless screens must behave like this page
        self.client.post(
            reverse('kobo_login'), data={'login': 'someuser', 'password': 'someuser'}
        )

        response = self.client.post(
            reverse('mfa_authenticate'), data={'code': LEGACY_CODES[0]}
        )

        assert response.status_code == status.HTTP_302_FOUND
        assert response['Location'] != reverse('mfa_authenticate')
        assert self._unused_legacy_code_count() == 1

    def test_wrong_code_is_rejected_once_every_legacy_code_is_spent(self):
        set_legacy_recovery_codes(self.someuser, [])
        self._start_login()

        response = self._post('auth/2fa/authenticate', {'code': 'not-a-code'})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert self._error_codes(response) == ['incorrect_code']

    def test_login_still_accepts_totp_and_allauth_recovery_codes(self):
        Authenticator.objects.filter(
            user=self.someuser, type=Authenticator.Type.RECOVERY_CODES
        ).delete()
        allauth_code = RecoveryCodes.activate(self.someuser).get_unused_codes()[0]

        # TOTP
        self._login()
        self.client.logout()
        self._start_login()
        response = self._post('auth/2fa/authenticate', {'code': allauth_code})

        assert response.status_code == status.HTTP_200_OK

    def test_reauthentication_without_mfa_is_rejected(self):
        Authenticator.objects.filter(user=self.someuser).delete()
        self.client.force_login(self.someuser)

        response = self._post('auth/2fa/reauthenticate', {'code': LEGACY_CODES[0]})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert self._error_codes(response) == ['incorrect_code']

    def test_login_with_legacy_recovery_code_through_app_client(self):
        response = self.client.post(
            f'{HEADLESS_APP_URL}/auth/login',
            data={'username': 'someuser', 'password': 'someuser'},
            content_type='application/json',
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        session_token = response.json()['meta']['session_token']

        response = self.client.post(
            f'{HEADLESS_APP_URL}/auth/2fa/authenticate',
            data={'code': LEGACY_CODES[0]},
            content_type='application/json',
            HTTP_X_SESSION_TOKEN=session_token,
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()['meta']['is_authenticated'] is True
        assert self._unused_legacy_code_count() == 1

    @override_settings(ACCOUNT_RATE_LIMITS={'login_failed': '10/15m/key'})
    def test_rate_limit_error_is_not_hidden(self):
        # A locked-out user must be told so, even when typing the right code
        cache.clear()
        self.addCleanup(cache.clear)
        self._start_login()
        for _ in range(10):
            response = self._post('auth/2fa/authenticate', {'code': 'not-a-code'})
            assert self._error_codes(response) == ['incorrect_code']

        response = self._post(
            'auth/2fa/authenticate', {'code': get_mfa_code_for_user(self.someuser)}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert self._error_codes(response) == ['too_many_login_attempts']


@override_config(MFA_ENABLED=True)
@override_settings(ACCOUNT_RATE_LIMITS=False)
class MfaCodeSerializerLegacyRecoveryCodesTestCase(BaseTestCase):
    """
    `MfaCodeSerializer` backs KPI's own 2FA endpoints (`/api/v2/auth/app/...`),
    so it is checked directly too
    """

    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        activate_mfa_for_user(self.client, self.someuser)

    def _is_valid(self, code):
        serializer = MfaCodeSerializer(
            data={'code': code},
            context={'user': self.someuser, 'method': MFA_METHOD_NAME},
        )
        # allauth's rate limiting reads the current request
        with context.request_context(RequestFactory().post('/')):
            return serializer.is_valid()

    def test_legacy_recovery_code_is_valid_once(self):
        set_legacy_recovery_codes(self.someuser, LEGACY_CODES)

        assert self._is_valid(LEGACY_CODES[0]) is True
        assert self._is_valid(LEGACY_CODES[0]) is False
        assert self._is_valid(LEGACY_CODES[1]) is True

    def test_stored_value_is_not_a_valid_code(self):
        recovery_codes = set_legacy_recovery_codes(self.someuser, LEGACY_CODES)
        stored_value = RecoveryCodes(recovery_codes)._get_migrated_codes()[0]

        assert self._is_valid(stored_value) is False

    def test_wrong_code_is_invalid_once_every_legacy_code_is_spent(self):
        # Used to raise `IndexError` on the empty list
        set_legacy_recovery_codes(self.someuser, [])

        assert self._is_valid('not-a-code') is False

    def test_legacy_recovery_code_spent_concurrently_is_invalid(self):
        set_legacy_recovery_codes(self.someuser, LEGACY_CODES)
        recovery_codes = Authenticator.objects.get(
            user=self.someuser, type=Authenticator.Type.RECOVERY_CODES
        )

        def check_password_after_concurrent_spend(code, hashed_code):
            # Another request spends the same code once this one has read the
            # list of codes, but before it spends the code itself
            if matches := check_password(code, hashed_code):
                assert RecoveryCodes(recovery_codes).validate_code(hashed_code)
            return matches

        with patch(
            'kobo.apps.accounts.mfa.utils.check_password',
            side_effect=check_password_after_concurrent_spend,
        ):
            assert self._is_valid(LEGACY_CODES[0]) is False
        assert self._is_valid(LEGACY_CODES[1]) is True


class HeadlessMfaRoutesTestCase(SimpleTestCase):
    """
    KPI's headless MFA views replace allauth's on allauth's own routes, for
    every client
    """

    def test_kpi_views_serve_the_mfa_routes(self):
        views = {
            'auth/2fa/authenticate': HeadlessMfaAuthenticateView,
            'auth/2fa/reauthenticate': HeadlessMfaReauthenticateView,
            'account/authenticators/totp': HeadlessManageTOTPView,
            'account/authenticators/recovery-codes': HeadlessManageRecoveryCodesView,
        }
        for client in Client:
            for url, view_class in views.items():
                match = resolve(f'/api/v2/allauth/{client.value}/v1/{url}')
                assert match.func.view_class is view_class
                assert match.func.view_initkwargs == {'client': client}

    def test_email_management_is_still_excluded(self):
        for client in Client:
            with self.assertRaises(Resolver404):
                resolve(f'/api/v2/allauth/{client.value}/v1/account/email')
