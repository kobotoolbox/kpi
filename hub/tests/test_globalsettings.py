# coding: utf-8
import constance
import pytest
from constance.test import override_config
from django.test import TestCase
from django.urls import reverse

from kpi.tests.utils.mixins import RequiresStripeAPIKeyMixin


class GlobalSettingsTestCase(TestCase, RequiresStripeAPIKeyMixin):

    fixtures = ['test_data']

    def setUp(self):
        self.url = reverse('api_v2:environment')

    @classmethod
    def setUpTestData(cls):
        cls.create_stripe_api_key()

    @pytest.mark.allow_openapi_mismatch(
        'response-validation',
        'api/v2/environment/',
        'GET',
    )
    @override_config(MFA_ENABLED=True)
    def test_mfa_enabled(self):
        self.client.login(username='someuser', password='someuser')
        self.assertTrue(constance.config.MFA_ENABLED)
        response = self.client.get(self.url)
        json_ = response.json()
        self.assertTrue(json_['mfa_enabled'])

    @pytest.mark.allow_openapi_mismatch(
        'response-validation',
        'api/v2/environment/',
        'GET',
    )
    @override_config(MFA_ENABLED=False)
    def test_mfa_disabled(self):
        self.client.login(username='someuser', password='someuser')
        self.assertFalse(constance.config.MFA_ENABLED)
        response = self.client.get(self.url)
        json_ = response.json()
        self.assertFalse(json_['mfa_enabled'])
