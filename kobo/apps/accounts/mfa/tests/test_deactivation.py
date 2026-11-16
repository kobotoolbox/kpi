from allauth.account.models import EmailAddress
from constance.test import override_config
from django.conf import settings
from django.test import TestCase, override_settings
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from ...tests.utils import record_authentication
from ..utils import user_has_active_mfa
from .utils import activate_mfa_for_user

TOTP_URL = '/api/v2/allauth/browser/v1/account/authenticators/totp'
RECOVERY_CODES_URL = '/api/v2/allauth/browser/v1/account/authenticators/recovery-codes'


@override_config(MFA_ENABLED=True)
@override_settings(ACCOUNT_RATE_LIMITS=False)
class MfaDeactivationTestCase(TestCase):
    """
    Turning 2FA off goes through allauth's headless TOTP endpoint only, and needs
    a recent 2FA code but not the password
    """

    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        EmailAddress.objects.update_or_create(
            user=self.user,
            email=self.user.email,
            defaults={'verified': True, 'primary': True},
        )
        activate_mfa_for_user(self.client, self.user)
        self.client.force_login(self.user)

    def test_code_reauthentication_turns_mfa_off(self):
        record_authentication(self.client, methods=('mfa',))

        response = self.client.delete(TOTP_URL)

        assert response.status_code == status.HTTP_200_OK
        assert not user_has_active_mfa(self.user)

    def test_password_reauthentication_alone_is_refused(self):
        record_authentication(self.client, methods=('password',))

        response = self.client.delete(TOTP_URL)

        self._assert_reauthentication_required(
            response, ['reauthenticate', 'mfa_reauthenticate']
        )

    def test_stale_reauthentication_is_refused(self):
        record_authentication(
            self.client,
            methods=('mfa',),
            age=settings.ACCOUNT_REAUTHENTICATION_TIMEOUT + 1,
        )

        response = self.client.delete(TOTP_URL)

        self._assert_reauthentication_required(
            response, ['reauthenticate', 'mfa_reauthenticate']
        )

    def test_sso_only_account_needs_the_code(self):
        self.user.set_unusable_password()
        self.user.save()
        self.client.force_login(self.user)

        response = self.client.delete(TOTP_URL)
        self._assert_reauthentication_required(response, ['mfa_reauthenticate'])

        record_authentication(self.client, methods=('mfa',))
        response = self.client.delete(TOTP_URL)
        assert response.status_code == status.HTTP_200_OK
        assert not user_has_active_mfa(self.user)

    def test_recovery_codes_regeneration_still_needs_one_method(self):
        # Unchanged: allauth's own rule, which any single method satisfies
        record_authentication(self.client, methods=('mfa',))

        response = self.client.post(RECOVERY_CODES_URL, content_type='application/json')

        assert response.status_code == status.HTTP_200_OK

    def test_templated_deactivation_page_redirects_to_security_settings(self):
        # allauth's page would accept the password alone. The test client skips
        # CSRF checks, so the POST reaches the redirect
        record_authentication(self.client, methods=('password',))

        for method in ('get', 'post'):
            response = getattr(self.client, method)('/accounts/2fa/totp/deactivate/')
            assert response.status_code == status.HTTP_302_FOUND
            assert response['Location'] == '/#/account/security'
        assert user_has_active_mfa(self.user)

    def test_legacy_deactivation_endpoint_is_gone(self):
        record_authentication(self.client, methods=('mfa',))

        response = self.client.post('/api/v2/auth/app/deactivate/')

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert user_has_active_mfa(self.user)

    def _assert_reauthentication_required(self, response, flow_ids):
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert [flow['id'] for flow in response.json()['data']['flows']] == flow_ids
        assert user_has_active_mfa(self.user)
