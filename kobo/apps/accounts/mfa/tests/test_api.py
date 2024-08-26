# coding: utf-8
from constance.test import override_config
from django.urls import reverse
from rest_framework import status
from trench.settings import trench_settings
from trench.utils import get_mfa_model

from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.kpi_test_case import BaseTestCase
from ..models import MfaAvailableToUser


class MfaApiTestCase(BaseTestCase):

    fixtures = ['test_data']

    """
    The purpose of this class is only to cover what the `mfa` app extends from
    `django-trench`. (i.e.: displaying dates)
    For the MFA API functionalities, see `django-trench` tests.
    """

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')

        # Activate MFA for someuser
        get_mfa_model().objects.create(
            user=self.someuser,
            secret='dummy_mfa_secret',
            name='app',
            is_primary=True,
            is_active=True,
            _backup_codes='dummy_encoded_codes',
        )
        self.client.login(username='someuser', password='someuser')

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
        mfa_methods = trench_settings.MFA_METHODS.keys()
        for method in mfa_methods:
            first_response = self.client.post(
                reverse('mfa-activate', args=(method,))
            )
            first_secret = (
                get_mfa_model()
                .objects.get(user__username='anotheruser', name=method)
                .secret
            )
            second_response = self.client.post(
                reverse('mfa-activate', args=(method,))
            )
            second_secret = (
                get_mfa_model()
                .objects.get(user__username='anotheruser', name=method)
                .secret
            )
            assert first_secret != second_secret
            assert first_response.json() != second_response.json()

    @override_config(MFA_ENABLED=True)
    def test_mfa_whitelisting(self):
        method = list(trench_settings.MFA_METHODS.keys())[0]
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
