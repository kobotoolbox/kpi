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
            'name': 'alice',
            User.USERNAME_FIELD: 'alice',
            'email': 'alice@example.com',
            'password1': 'swordfish',
            'password2': 'swordfish',
        }

    # use `override_config` decorator to deactivate all password validators
    # to let this test use a simple password.
    @override_config(
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
    )
    def test_empty_string_allows_all_domains(self):
        self.assertEqual(
            constance.config.REGISTRATION_ALLOWED_EMAIL_DOMAINS, ''
        )
        response = self.client.post(
            reverse('account_signup'), data=self.valid_data
        )
        self.assertRedirects(response, '/accounts/confirm-email/')

    # use `override_config` decorator to deactivate all password validators
    # to let this test use a simple password.
    @override_config(
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
        REGISTRATION_ALLOWED_EMAIL_DOMAINS='foo.bar\nexample.com'
    )
    def test_allowed_domain_can_register(self):
        response = self.client.post(
            reverse('account_signup'), data=self.valid_data
        )
        self.assertRedirects(response, '/accounts/confirm-email/')

    # use `override_config` decorator to deactivate all password validators
    # to let this test use a simple password.
    @override_config(
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
        REGISTRATION_ALLOWED_EMAIL_DOMAINS='foo.bar\nbaz.qux'
    )
    def test_disallowed_domain_cannot_register(self):
        response = self.client.post(
            reverse('account_signup'), data=self.valid_data
        )
        self.assertIn(
            t('This email domain is not allowed to create an account').encode(),
            response.content,
        )
