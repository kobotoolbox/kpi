# coding: utf-8
import constance
from constance.test import override_config
from django.urls import reverse
from django.test import TestCase


class GlobalSettingsTestCase(TestCase):

    fixtures = ['test_data']

    @override_config(MFA_ENABLED=True)
    def test_mfa_enabled(self):
        self.client.login(username='someuser', password='someuser')
        self.assertTrue(constance.config.MFA_ENABLED)
        response = self.client.get(reverse('kpi-root'))
        lines = [line.strip() for line in response.content.decode().split('\n')]
        self.assertTrue("window.MFAEnabled = true;" in lines)

    @override_config(MFA_ENABLED=False)
    def test_mfa_disabled(self):
        self.client.login(username='someuser', password='someuser')
        self.assertFalse(constance.config.MFA_ENABLED)
        response = self.client.get(reverse('kpi-root'))
        lines = [line.strip() for line in response.content.decode().split('\n')]
        self.assertTrue("window.MFAEnabled = false;" in lines)
