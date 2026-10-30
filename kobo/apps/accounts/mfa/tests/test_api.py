from unittest.mock import patch

from allauth.mfa.models import Authenticator
from allauth.mfa.totp.internal.auth import SECRET_SESSION_KEY
from constance.test import override_config
from django.test import override_settings
from django.urls import reverse
from freezegun import freeze_time
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.main.models import UserProfile
from kpi.tests.kpi_test_case import BaseTestCase
from ..utils import get_totp_authenticator
from .utils import (
    activate_mfa_for_user,
    get_mfa_code_for_user,
    get_pending_mfa_code,
)

METHOD = 'app'


@freeze_time('2026-01-01 12:00:00')
@override_settings(ACCOUNT_RATE_LIMITS=False)
class MfaApiTestCase(BaseTestCase):

    fixtures = ['test_data']

    """
    The purpose of this class is to cover the MFA API actions
    """

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')

        # Activate MFA for someuser
        activate_mfa_for_user(self.client, self.someuser)

        # Log in
        self.client.force_login(self.someuser)

    def test_user_methods_with_date(self):

        response = self.client.get(reverse('mfa_list_user_methods'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json()
        totp = get_totp_authenticator(self.someuser)
        assert results == [
            {
                'name': METHOD,
                'is_active': True,
                'date_created': '2026-01-01T12:00:00Z',
                'date_modified': '2026-01-01T12:00:00Z',
                'date_disabled': None,
            }
        ]
        assert totp.created_at.isoformat() == '2026-01-01T12:00:00+00:00'

    def test_user_methods_empty_once_deactivated(self):
        code = get_mfa_code_for_user(self.someuser)
        response = self.client.post(
            reverse('mfa-deactivate', args=(METHOD,)), data={'code': code}
        )
        assert response.status_code == status.HTTP_200_OK

        response = self.client.get(reverse('mfa_list_user_methods'))
        assert response.json() == []

    @override_config(MFA_ENABLED=True)
    def test_unknown_method_not_found(self):
        response = self.client.post(reverse('mfa-activate', args=('sms',)))
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @override_config(MFA_ENABLED=True)
    def test_mfa_activation_always_creates_new_secret(self):
        self.client.login(username='anotheruser', password='anotheruser')
        first_response = self.client.post(reverse('mfa-activate', args=(METHOD,)))
        first_secret = self.client.session[SECRET_SESSION_KEY]

        # Since it was never confirmed, it will generate another secret
        second_response = self.client.post(reverse('mfa-activate', args=(METHOD,)))
        second_secret = self.client.session[SECRET_SESSION_KEY]
        assert first_secret != second_secret
        assert first_response.json() != second_response.json()

    def test_regenerate_codes(self):
        response = self.client.post(
            reverse('mfa-regenerate', args=(METHOD,)), data={'code': '1234567890'}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        code = get_mfa_code_for_user(self.someuser)
        response = self.client.post(
            reverse('mfa-regenerate', args=(METHOD,)), data={'code': code}
        )

        assert len(response.data['backup_codes']) == 5

    def test_deactivate(self):
        response = self.client.post(
            reverse('mfa-deactivate', args=(METHOD,)), data={'code': '1234567890'}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        code = get_mfa_code_for_user(self.someuser)
        response = self.client.post(
            reverse('mfa-deactivate', args=(METHOD,)), data={'code': code}
        )

        assert response.status_code == status.HTTP_200_OK
        assert Authenticator.objects.filter(user=self.someuser).count() == 0

    def test_reactivate_generates_different_secret(self):
        """
        Test that MFA can be deactivated and reactivated/confirmed with different secret
        """
        first_secret = get_totp_authenticator(self.someuser).data['secret']
        code = get_mfa_code_for_user(self.someuser)
        response = self.client.post(
            reverse('mfa-deactivate', args=(METHOD,)), data={'code': code}
        )
        assert response.status_code == status.HTTP_200_OK

        self.client.post(reverse('mfa-activate', kwargs={'method': METHOD}))
        code = get_pending_mfa_code(self.client)
        confirm_response = self.client.post(
            reverse('mfa-confirm', kwargs={'method': METHOD}), data={'code': str(code)}
        )
        assert confirm_response.status_code == status.HTTP_200_OK
        second_secret = get_totp_authenticator(self.someuser).data['secret']
        assert first_secret != second_secret

    def test_mfa_activation_syncs_user_profile(self):
        """
        Test that activating MFA also updates the `is_mfa_active` flag in UserProfile
        """
        profile, _ = UserProfile.objects.get_or_create(user=self.someuser)
        profile.refresh_from_db()
        self.assertTrue(profile.is_mfa_active)

    def test_mfa_deactivation_syncs_user_profile(self):
        """
        Test that deactivating MFA also updates the `is_mfa_active` flag in UserProfile
        """
        profile, _ = UserProfile.objects.get_or_create(user=self.someuser)
        profile.refresh_from_db()
        self.assertTrue(profile.is_mfa_active)

        code = get_mfa_code_for_user(self.someuser)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                reverse('mfa-deactivate', args=(METHOD,)), data={'code': code}
            )
        assert response.status_code == status.HTTP_200_OK

        profile.refresh_from_db()
        self.assertFalse(profile.is_mfa_active)

    @override_config(MFA_ENABLED=True)
    def test_failed_activation_does_not_sync_user_profile(self):
        """
        If activation fails after the TOTP authenticator was created, the KPI
        transaction is rolled back and the KoboCAT profile must not be touched
        (in production it lives in another database, which would keep the flag)
        """
        anotheruser = User.objects.get(username='anotheruser')
        self.client.force_login(anotheruser)
        self.client.post(reverse('mfa-activate', args=(METHOD,)))
        code = get_pending_mfa_code(self.client)

        with (
            patch(
                'kobo.apps.accounts.mfa.flows.auto_generate_recovery_codes',
                side_effect=RuntimeError('boom'),
            ),
            patch.object(UserProfile, 'set_mfa_status') as set_mfa_status,
            self.captureOnCommitCallbacks(execute=True),
            self.assertRaises(RuntimeError),
        ):
            self.client.post(
                reverse('mfa-confirm', args=(METHOD,)), data={'code': code}
            )

        assert get_totp_authenticator(anotheruser) is None
        set_mfa_status.assert_not_called()

    @override_config(SUPERUSER_AUTH_ENFORCEMENT=True)
    def test_superuser_deactivation_prohibited_when_enforced(self):
        """
        Verify that a superuser cannot deactivate MFA if SUPERUSER_AUTH_ENFORCEMENT
        is True
        """
        superuser = User.objects.create_superuser(
            username='admin_user', password='adminpassword', email='admin@example.com'
        )
        activate_mfa_for_user(self.client, superuser)
        self.client.force_login(superuser)

        code = get_mfa_code_for_user(superuser)
        response = self.client.post(
            reverse('mfa-deactivate', args=(METHOD,)), data={'code': code}
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            response.json()['detail'],
            'Superusers cannot deactivate MFA while SUPERUSER_AUTH_ENFORCEMENT'
            ' is active.',
        )

        self.assertIsNotNone(get_totp_authenticator(superuser))
