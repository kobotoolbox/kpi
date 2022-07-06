# coding: utf-8
import constance
from constance.test import override_config
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils.translation import gettext as t


class RegistrationTestCase(TestCase):
    @property
    def valid_data(self):
        User = get_user_model()
        return {
            User.USERNAME_FIELD: "alice",
            "email": "alice@example.com",
            "password1": "swordfish",
            "password2": "swordfish",
        }

    def test_empty_string_allows_all_domains(self):
        self.assertEqual(
            constance.config.REGISTRATION_ALLOWED_EMAIL_DOMAINS, ''
        )
        response = self.client.post(
            reverse("registration_register"), data=self.valid_data
        )
        self.assertRedirects(response, '/accounts/register/complete/')

    @override_config(REGISTRATION_ALLOWED_EMAIL_DOMAINS='foo.bar\nexample.com')
    def test_allowed_domain_can_register(self):
        response = self.client.post(
            reverse("registration_register"), data=self.valid_data
        )
        self.assertRedirects(response, '/accounts/register/complete/')

    @override_config(REGISTRATION_ALLOWED_EMAIL_DOMAINS='foo.bar\nbaz.qux')
    def test_disallowed_domain_cannot_register(self):
        response = self.client.post(
            reverse("registration_register"), data=self.valid_data
        )
        self.assertIn(
            t('This email domain is not allowed to create an account').encode(),
            response.content,
        )
