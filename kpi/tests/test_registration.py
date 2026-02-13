# coding: utf-8
import constance
from constance.test import override_config
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils.translation import gettext as t

from kobo.apps.kobo_auth.shortcuts import User


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

    @override_config(
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
        REGISTRATION_BLACKLIST_EMAIL_DOMAINS='bad-domain.com\nmalicious.net',
        REGISTRATION_BLACKLIST_ERROR_MESSAGE='Go away!'
    )
    def test_blacklisted_domain_cannot_register(self):
        data = self.valid_data.copy()
        data['email'] = 'hacker@bad-domain.com'

        response = self.client.post(
            reverse('account_signup'), data=data
        )
        self.assertIn(b'Go away!', response.content)
        self.assertFalse(User.objects.filter(username='alice').exists())

    @override_config(
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
        REGISTRATION_BLACKLIST_EMAIL_DOMAINS='bad-domain.com'
    )
    def test_non_blacklisted_domain_can_register(self):
        response = self.client.post(
            reverse('account_signup'), data=self.valid_data
        )
        self.assertRedirects(response, '/accounts/confirm-email/')

    @override_config(
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
    )
    def test_empty_blacklist_allows_registration(self):
        response = self.client.post(
            reverse('account_signup'), data=self.valid_data
        )
        self.assertRedirects(response, '/accounts/confirm-email/')

    @override_config(
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
        REGISTRATION_BLACKLIST_EMAIL_DOMAINS='bad-domain.com'
    )
    def test_default_blacklist_error_message(self):
        """
        Test that if a blacklisted domain is used, and there is no custom error
        message set, registration should be blocked and the default error message
        should be shown
        """
        data = self.valid_data.copy()
        data['email'] = 'user@bad-domain.com'

        response = self.client.post(
            reverse('account_signup'), data=data
        )
        self.assertIn(
            b'Account creation restricted for this server. '
            b'Your organization uses a separate private KoboToolbox server. '
            b'Please contact your organization support team for assistance.',
            response.content
        )
