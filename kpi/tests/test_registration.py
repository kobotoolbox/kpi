# coding: utf-8
import constance
from allauth.socialaccount.adapter import get_adapter as get_social_adapter
from allauth.socialaccount.models import SocialApp, SocialLogin
from constance.test import override_config
from ddt import data, ddt, unpack
from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase, override_settings
from django.urls import reverse
from django.utils.translation import gettext as t

from kobo.apps.accounts.models import SocialAppCustomData, SocialAppManagedDomain
from kobo.apps.accounts.tests.constants import SOCIALACCOUNT_PROVIDERS
from kobo.apps.accounts.tests.utils import MockProvider
from kobo.apps.kobo_auth.shortcuts import User


@ddt
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
        response = self.client.post(reverse('account_signup'), data=self.valid_data)
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
        response = self.client.post(reverse('account_signup'), data=self.valid_data)
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
        self.assertFalse(User.objects.filter(username='alice').exists())

    @override_settings(SOCIALACCOUNT_PROVIDERS=SOCIALACCOUNT_PROVIDERS)
    def test_cannot_use_password_with_managed_social_app(self):
        social_app = SocialApp.objects.create(
            client_id='test.service.id',
            secret='test.service.secret',
            name='Test App',
            provider='Test App',
        )
        custom_data = SocialAppCustomData.objects.create(
            social_app=social_app, managed=True
        )
        SocialAppManagedDomain.objects.create(
            domain='example.com', social_app=custom_data
        )
        data = self.valid_data.copy()
        data['email'] = 'user@example.com'

        response = self.client.post(reverse('account_signup'), data=data)
        self.assertIn(
            b'Your organization has restricted the use of passwords.'
            b' Please sign up using SSO instead.',
            response.content,
        )
        self.assertFalse(User.objects.filter(username='alice').exists())

    @override_settings(SOCIALACCOUNT_PROVIDERS=SOCIALACCOUNT_PROVIDERS)
    def test_can_use_password_with_unmanaged_social_app(self):
        social_app = SocialApp.objects.create(
            client_id='test.service.id',
            secret='test.service.secret',
            name='Test App',
            provider='Test App',
        )
        custom_data = SocialAppCustomData.objects.create(social_app=social_app)
        SocialAppManagedDomain.objects.create(
            domain='example.com', social_app=custom_data
        )
        data = self.valid_data.copy()
        data['email'] = 'user@example.com'

        self.client.post(reverse('account_signup'), data=data)
        self.assertTrue(User.objects.filter(username='alice').exists())

    @override_config(REGISTRATION_OPEN=False)
    @data(
        # managed, matching email, expect success
        (True, True, True),
        (True, False, False),
        (False, True, False),
        (False, False, False),
    )
    @unpack
    def test_registration_closed_with_managed_sso(
        self, managed, matching_email, expect_success
    ):
        email = 'uSeR@eXaMpLe.com' if matching_email else 'user@other.com'
        request = RequestFactory().get(reverse('account_login'))

        provider = MockProvider(request=request)
        social_app = SocialApp.objects.create(
            client_id='test.service.id',
            secret='test.service.secret',
            name='Test App',
            provider=provider.id,
        )
        provider.app = social_app
        social_login = SocialLogin(user=User(email=email), provider=provider)

        custom_data = SocialAppCustomData.objects.create(
            social_app=social_app, managed=managed
        )
        SocialAppManagedDomain.objects.create(
            domain='example.com', social_app=custom_data
        )
        success = get_social_adapter().is_open_for_signup(request, social_login)
        assert success is expect_success

    @override_config(REGISTRATION_OPEN=False)
    def test_registration_closed_with_different_sso(self):
        # edge case: user tries to register with a different SSO than the
        # one that manages their domain
        email = 'uSeR@eXaMpLe.com'
        request = RequestFactory().get(reverse('account_login'))
        provider = MockProvider(request=request)

        # unrelated social app, used for login (matched by provider)
        user_social_app = SocialApp.objects.create(
            client_id='test.service.id',
            secret='test.service.secret',
            name='Test Provider',
            provider=provider.id,
        )

        managed_social_app = SocialApp.objects.create(
            client_id='test.service.id2',
            secret='test.service.secret2',
            name='Test App 2',
            provider='Test App 2',
        )
        provider.app = user_social_app

        social_login = SocialLogin(user=User(email=email), provider=provider)

        custom_data = SocialAppCustomData.objects.create(
            social_app=managed_social_app, managed=True
        )
        SocialAppManagedDomain.objects.create(
            domain='example.com', social_app=custom_data
        )
        success = get_social_adapter().is_open_for_signup(request, social_login)
        assert success is False
