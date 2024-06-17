# coding: utf-8
import constance
from constance.test import override_config
from django.urls import reverse
from django.test import TestCase
from django.test import override_settings


@override_settings(STRIPE_ENABLED=False)
class GlobalSettingsTestCase(TestCase):

    fixtures = ['test_data']

    @override_config(MFA_ENABLED=True)
    def test_mfa_enabled(self):
        self.client.login(username='someuser', password='someuser')
        self.assertTrue(constance.config.MFA_ENABLED)
        response = self.client.get(reverse('environment'))
        json_ = response.json()
        self.assertTrue(json_['mfa_enabled'])

    @override_config(MFA_ENABLED=False)
    def test_mfa_disabled(self):
        self.client.login(username='someuser', password='someuser')
        self.assertFalse(constance.config.MFA_ENABLED)
        response = self.client.get(reverse('environment'))
        json_ = response.json()
        self.assertFalse(json_['mfa_enabled'])
