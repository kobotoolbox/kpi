from constance.test import override_config
from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.kpi_test_case import BaseTestCase
from ..models import MfaAvailableToUser, MfaMethodsWrapper
from .utils import activate_mfa_for_user, get_mfa_code_for_user

METHOD = 'app'


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
        first_response = self.client.post(reverse('mfa-activate', args=(METHOD,)))
        first_secret = MfaMethodsWrapper.objects.get(
            user__username='anotheruser', name=METHOD
        ).secret

        # Since it was never confirmed, it will generate another secret
        second_response = self.client.post(reverse('mfa-activate', args=(METHOD,)))
        second_secret = MfaMethodsWrapper.objects.get(
            user__username='anotheruser', name=METHOD
        ).secret
        assert first_secret != second_secret
        assert first_response.json() != second_response.json()

    @override_config(MFA_ENABLED=True)
    def test_mfa_whitelisting(self):
        anotheruser = User.objects.get(username='anotheruser')
        self.client.login(username='anotheruser', password='anotheruser')

        # Test when whitelist is disabled
        activate_response = self.client.post(reverse('mfa-activate', args=(METHOD,)))
        assert activate_response.status_code == status.HTTP_200_OK

        # Enable the MFA whitelist by adding a user
        someuser_mfa_activation = MfaAvailableToUser.objects.create(
            user=self.someuser
        )

        activate_response = self.client.post(reverse('mfa-activate', args=(METHOD,)))
        assert activate_response.status_code == status.HTTP_403_FORBIDDEN

        mfa_availability = MfaAvailableToUser.objects.create(user=anotheruser)
        activate_response = self.client.post(reverse('mfa-activate', args=(METHOD,)))
        assert activate_response.status_code == status.HTTP_200_OK

        # Reset MFA whitelist state
        mfa_availability.delete()
        someuser_mfa_activation.delete()

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
        mfamethods = MfaMethodsWrapper.objects.get(user=self.someuser)
        assert mfamethods.is_active is False

    def test_reactivate_generates_different_secret(self):
        """
        Test that MFA can be deactivated and reactivated/confirmed with different secret
        """
        first_secret = MfaMethodsWrapper.objects.get(
            user=self.someuser, name=METHOD
        ).secret
        code = get_mfa_code_for_user(self.someuser)
        response = self.client.post(
            reverse('mfa-deactivate', args=(METHOD,)), data={'code': code}
        )
        assert response.status_code == status.HTTP_200_OK

        self.client.post(reverse('mfa-activate', kwargs={'method': METHOD}))
        code = get_mfa_code_for_user(self.someuser)
        confirm_response = self.client.post(
            reverse('mfa-confirm', kwargs={'method': METHOD}), data={'code': str(code)}
        )
        assert confirm_response.status_code == status.HTTP_200_OK
        second_secret = MfaMethodsWrapper.objects.get(
            user=self.someuser, name=METHOD
        ).secret
        assert first_secret != second_secret
