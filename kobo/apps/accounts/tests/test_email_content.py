from constance.test import override_config
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings, TestCase
from django.urls import reverse
from rest_framework import status


from kobo.apps.accounts.models import EmailContent


class EmailContentModelTestCase(TestCase):
    """
    These tests are to ensure both the custom activation email and the default
    activation emails work as expected
    """
    def setUp(self) -> None:
        self.signup_url = reverse('account_signup')

    @override_settings(
        CACHES={
            'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}
        }
    )
    # use `override_config` decorator to deactivate all password validators
    # to let this test use a simple password.
    @override_config(
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
    )
    def test_custom_activation_email_template(self):
        email_content = EmailContent.objects.create(
            email_name='email_confirmation_signup_message',
            section_name='section_one',
            content='This is some content to test'
        )
        email_subject = EmailContent.objects.create(
            email_name='email_confirmation_signup_message',
            section_name='subject',
            content='This is a test subject line'
        )
        username = 'user001'
        email = username + '@example.com'
        data = {
            'name': 'username',
            'email': email,
            'password1': username,
            'password2': username,
            'username': username,
        }
        request = self.client.post(self.signup_url, data)
        user = get_user_model().objects.get(email=email)
        assert request.status_code == status.HTTP_302_FOUND
        self.client.login(username=user.username, password=user.password)
        self.client.get(reverse('account_email_verification_sent'))
        assert len(mail.outbox) == 1
        assert mail.outbox[0].subject == email_subject.content
        assert email_content.content in mail.outbox[0].body

    @override_settings(
        CACHES={
            'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}
        }
    )
    # use `override_config` decorator to deactivate all password validators
    # to let this test use a simple password.
    @override_config(
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
    )
    def test_custom_activation_email_template_blank_content(self):
        email_content = EmailContent.objects.create(
            email_name='email_confirmation_signup_message',
            section_name='section_one',
            content=''
        )
        email_content_closing = EmailContent.objects.create(
            email_name='email_confirmation_signup_message',
            section_name='section_two',
            content=''
        )
        email_subject = EmailContent.objects.create(
            email_name='email_confirmation_signup_message',
            section_name='subject',
            content=''
        )
        username = 'user002'
        email = username + '@example.com'
        data = {
            'name': username,
            'email': email,
            'password1': username,
            'password2': username,
            'username': username,
        }
        default = "Thanks for signing up with KoboToolbox!"
        # This is unreliable. On commit
        # 3d4dbdd4ac16b5739237fd9957d0140f50f17280, this assertion passes when
        # the entire test suite is run, but it fails when the this unit test is
        # run individually (43 queries are logged). It also fails on
        # 2eb5877faa2b2cda58c709fa07ec0fd914889a6c: when running the complete
        # suite, 44 queries are logged, and when running individually, 45 are
        # logged. I'm disabling the assertion for now. —jnm
        #
        # with self.assertNumQueries(42):
        #    request = self.client.post(self.signup_url, data)
        request = self.client.post(self.signup_url, data)
        user = get_user_model().objects.get(email=email)
        assert request.status_code == status.HTTP_302_FOUND
        self.client.login(username=user.username, password=user.password)
        self.client.get(reverse('account_email_verification_sent'))
        assert len(mail.outbox) == 1
        assert mail.outbox[0].subject == 'Activate your KoboToolbox Account'
        assert email_content.content in mail.outbox[0].body
        assert default not in mail.outbox[0].body

    @override_settings(
        CACHES={
            'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}
        }
    )
    # use `override_config` decorator to deactivate all password validators
    # to let this test use a simple password.
    @override_config(
        ENABLE_PASSWORD_MINIMUM_LENGTH_VALIDATION=False,
        ENABLE_PASSWORD_USER_ATTRIBUTE_SIMILARITY_VALIDATION=False,
        ENABLE_MOST_RECENT_PASSWORD_VALIDATION=False,
        ENABLE_COMMON_PASSWORD_VALIDATION=False,
        ENABLE_PASSWORD_CUSTOM_CHARACTER_RULES_VALIDATION=False,
    )
    def test_default_activation_email_template(self):
        username = 'user003'
        email = username + '@example.com'
        data = {
            'name': username,
            'email': email,
            'password1': username,
            'password2': username,
            'username': username,
        }
        default_subject = "Activate your KoboToolbox Account"
        default_greeting = "Thanks for signing up with KoboToolbox!"
        default_body = "Confirming your account will give you access to " \
                       "KoboToolbox applications. Please visit the following " \
                       "URL to finish activation of your new account."
        default_closing = "For help getting started, check out the KoboToolbox " \
                          "user documentation: https://support.kobotoolbox.com "
        request = self.client.post(self.signup_url, data)
        user = get_user_model().objects.get(email=email)
        assert request.status_code == status.HTTP_302_FOUND
        self.client.login(username=user.username, password=user.password)
        self.client.get(reverse('account_email_verification_sent'))
        assert len(mail.outbox) == 1
        assert mail.outbox[0].subject == default_subject
        assert default_greeting in mail.outbox[0].body
        assert default_body in mail.outbox[0].body
        assert default_closing in mail.outbox[0].body
        assert "Best,\nKoboToolbox" in mail.outbox[0].body
