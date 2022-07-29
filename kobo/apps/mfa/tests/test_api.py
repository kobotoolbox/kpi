# coding: utf-8
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from trench.settings import api_settings
from trench.utils import get_mfa_model

from kpi.tests.kpi_test_case import BaseTestCase


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

    def test_mfa_activation_always_creates_new_secret(self):
        self.client.login(username='anotheruser', password='anotheruser')
        mfa_methods = api_settings.MFA_METHODS.keys()
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
