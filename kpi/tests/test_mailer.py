from unittest.mock import MagicMock, Mock, patch

from django.conf import settings
from django.core.mail import EmailMessage
from django.test import TestCase, override_settings


def fake_send(email_message):
    """
    Fake _send that replaces SMTP sending and asserts the header.
    """

    if settings.AWS_SES_CONFIGURATION_SET:
        assert 'X-SES-CONFIGURATION-SET' in email_message.extra_headers
        assert (
            email_message.extra_headers['X-SES-CONFIGURATION-SET'] == 'foo-config-set'
        )
    else:
        assert 'X-SES-CONFIGURATION-SET' not in email_message.extra_headers

    return True


class TestEmailBackend(TestCase):

    @override_settings(
        EMAIL_BACKEND='kpi.utils.mailer.EmailBackend',
        AWS_SES_CONFIGURATION_SET='foo-config-set',
    )
    def test_aws_configuration_set_header_added(self):

        mocked_send = Mock(side_effect=fake_send)

        with (
            patch('smtplib.SMTP', MagicMock()),
            patch(
                'django.core.mail.backends.smtp.EmailBackend.close', return_value=None
            ),
            patch('django.core.mail.backends.smtp.EmailBackend._send', new=mocked_send),
        ):
            msg = EmailMessage(
                'Test',
                'Hello',
                'from@example.com',
                ['to@example.com'],
            )

            assert msg.send() == 1

        mocked_send.assert_called_once()

    @override_settings(
        EMAIL_BACKEND='kpi.utils.mailer.EmailBackend',
        AWS_SES_CONFIGURATION_SET=None,
    )
    def test_no_headers_added_if_aws_configuration_set_is_not_set(self):

        mocked_send = Mock(side_effect=fake_send)

        with (
            patch('smtplib.SMTP', MagicMock()),
            patch(
                'django.core.mail.backends.smtp.EmailBackend.close', return_value=None
            ),
            patch('django.core.mail.backends.smtp.EmailBackend._send', new=mocked_send),
        ):
            msg = EmailMessage(
                'Test',
                'Hello',
                'from@example.com',
                ['to@example.com'],
            )

            assert msg.send() == 1
