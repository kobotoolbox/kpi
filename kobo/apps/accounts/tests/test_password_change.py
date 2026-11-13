from unittest.mock import patch

from allauth.headless import app_settings as headless_settings
from allauth.mfa.models import Authenticator
from constance.test import override_config
from ddt import data, ddt
from django.test import TestCase, override_settings
from django.urls import Resolver404, resolve, reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from ..mfa.tests.utils import (
    activate_mfa_for_user,
    get_mfa_code_for_user,
    set_legacy_recovery_codes,
)

CURRENT_PASSWORD = 'someuser'
NEW_PASSWORD = 'a-brand-new-password'
HEADLESS_PASSWORD_CHANGE_URL = '/api/v2/allauth/{client}/v1/account/password/change'


@override_config(
    MFA_ENABLED=True,
    ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
    ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
    ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False,
    ENABLE_COMMON_PASSWORD_VALIDATION=False,
    ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
)
@override_settings(ACCOUNT_RATE_LIMITS=False)
class MePasswordChangeWithMfaTestCase(TestCase):
    """
    With 2FA on, changing the password through `PATCH /me/` needs a 2FA code as
    well as the current password
    """

    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        activate_mfa_for_user(self.client, self.user)
        self.client.force_login(self.user)

    def test_missing_code_is_rejected(self):
        response = self._change_password()

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert list(response.json()) == ['mfa_code']
        self._assert_password_unchanged()

    def test_wrong_code_is_rejected(self):
        response = self._change_password(mfa_code='000000')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.json() == {'mfa_code': ['Invalid code.']}
        self._assert_password_unchanged()

    def test_totp_code_changes_password(self):
        response = self._change_password(mfa_code=get_mfa_code_for_user(self.user))

        assert response.status_code == status.HTTP_200_OK
        self._assert_password_changed()

    def test_recovery_code_changes_password_and_is_spent(self):
        recovery_codes = Authenticator.objects.get(
            user=self.user, type=Authenticator.Type.RECOVERY_CODES
        ).wrap()
        code = recovery_codes.get_unused_codes()[0]

        response = self._change_password(mfa_code=code)

        assert response.status_code == status.HTTP_200_OK
        self._assert_password_changed()
        recovery_codes.instance.refresh_from_db()
        assert code not in recovery_codes.get_unused_codes()

    def test_legacy_recovery_code_changes_password(self):
        # Codes migrated from the former 2FA system are stored hashed (DEV-3251)
        set_legacy_recovery_codes(self.user, ['legacy-code'])

        response = self._change_password(mfa_code='legacy-code')

        assert response.status_code == status.HTTP_200_OK
        self._assert_password_changed()

    def test_rejected_request_does_not_spend_code(self):
        with patch('kpi.serializers.current_user.is_valid_mfa_code') as validate:
            wrong_password = self._change_password(
                current_password='wrong', mfa_code='123456'
            )
            with override_config(ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=True):
                invalid_password = self._change_password(
                    new_password='short', mfa_code='123456'
                )

        assert list(wrong_password.json()) == ['current_password']
        assert list(invalid_password.json()) == ['new_password']
        validate.assert_not_called()

    def test_code_not_needed_without_mfa(self):
        Authenticator.objects.filter(user=self.user).delete()

        response = self._change_password()

        assert response.status_code == status.HTTP_200_OK
        self._assert_password_changed()

    def test_code_not_needed_for_other_changes(self):
        response = self.client.patch(
            reverse('currentuser-detail'),
            data={'extra_details': {'name': 'Some User'}},
            content_type='application/json',
        )

        assert response.status_code == status.HTTP_200_OK

    def _change_password(self, **extra):
        return self.client.patch(
            reverse('currentuser-detail'),
            data={
                'current_password': CURRENT_PASSWORD,
                'new_password': NEW_PASSWORD,
                **extra,
            },
            content_type='application/json',
        )

    def _assert_password_changed(self):
        self.user.refresh_from_db()
        assert self.user.check_password(NEW_PASSWORD)

    def _assert_password_unchanged(self):
        self.user.refresh_from_db()
        assert self.user.check_password(CURRENT_PASSWORD)


@ddt
@override_settings(ACCOUNT_RATE_LIMITS=False)
class BlockedPasswordChangeEndpointsTestCase(TestCase):
    """
    `PATCH /me/` is the only way to change a password, so allauth's own
    password change endpoints must not be reachable
    """

    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.client.force_login(self.user)

    @data(*headless_settings.CLIENTS)
    def test_headless_password_change_is_not_routed(self, client):
        # Excluded from allauth's routes, not merely masked by an earlier one
        with self.assertRaises(Resolver404):
            resolve(HEADLESS_PASSWORD_CHANGE_URL.format(client=client))

    def test_headless_password_change_is_not_found(self):
        response = self.client.post(
            HEADLESS_PASSWORD_CHANGE_URL.format(client='browser'),
            data={'current_password': CURRENT_PASSWORD, 'new_password': NEW_PASSWORD},
            content_type='application/json',
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        self._assert_password_unchanged()

    @data('get', 'post')
    def test_templated_password_change_page_redirects_to_security_settings(
        self, method
    ):
        # The test client skips CSRF checks, so the POST reaches the redirect
        response = getattr(self.client, method)(
            '/accounts/password/change/',
            data={
                'oldpassword': CURRENT_PASSWORD,
                'password1': NEW_PASSWORD,
                'password2': NEW_PASSWORD,
            },
        )

        assert response.status_code == status.HTTP_302_FOUND
        assert response['Location'] == '/#/account/security'
        self._assert_password_unchanged()

    def test_account_change_password_still_reverses_to_the_redirect(self):
        # allauth reverses this name itself (after a password is set, from its
        # templates); removing it would raise `NoReverseMatch` there
        assert reverse('account_change_password') == '/accounts/password/change/'
        assert reverse('mfa_deactivate_totp') == '/accounts/2fa/totp/deactivate/'

    def test_schema_excludes_blocked_endpoint(self):
        from kpi.utils.spectacular_processing import merge_allauth_headless_schema

        result = merge_allauth_headless_schema(
            {'paths': {}}, generator=None, request=None, public=True
        )

        for client in headless_settings.CLIENTS:
            assert (
                HEADLESS_PASSWORD_CHANGE_URL.format(client=client)
                not in result['paths']
            )

    def _assert_password_unchanged(self):
        self.user.refresh_from_db()
        assert self.user.check_password(CURRENT_PASSWORD)
