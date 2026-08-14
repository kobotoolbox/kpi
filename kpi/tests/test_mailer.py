from smtplib import SMTPException, SMTPServerDisconnected
from unittest.mock import MagicMock, Mock, patch

from django.conf import settings
from django.core.mail import EmailMessage
from django.test import TestCase, override_settings

from kpi.utils.mailer import (
    is_connection_alive,
    reset_connection,
    with_smtp_connection,
)


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


class TestConnectionHelpers(TestCase):
    """
    Cover the connection reuse helpers backing bulk sending.
    """

    def test_smtp_connection_is_opened_once_and_closed(self):
        connection = MagicMock()

        class Sender:
            @with_smtp_connection
            def run(self):
                # The connection is available for the whole call
                assert self.connection is connection
                return 'done'

        with patch('kpi.utils.mailer.get_connection', return_value=connection):
            assert Sender().run() == 'done'

        assert connection.open.call_count == 1
        assert connection.close.call_count == 1

    def test_smtp_connection_is_closed_when_the_method_raises(self):
        connection = MagicMock()

        class Sender:
            @with_smtp_connection
            def run(self):
                raise ValueError('boom')

        with patch('kpi.utils.mailer.get_connection', return_value=connection):
            with self.assertRaises(ValueError):
                Sender().run()

        assert connection.close.call_count == 1

    def test_closing_error_does_not_mask_the_original_one(self):
        connection = MagicMock()
        connection.close.side_effect = SMTPException('cannot quit')

        class Sender:
            @with_smtp_connection
            def run(self):
                raise ValueError('the real error')

        with patch('kpi.utils.mailer.get_connection', return_value=connection):
            with self.assertRaises(ValueError) as context:
                Sender().run()

        assert str(context.exception) == 'the real error'

    def test_connection_is_released_after_the_call(self):
        connection = MagicMock()

        class Sender:
            @with_smtp_connection
            def run(self):
                return None

        sender = Sender()
        with patch('kpi.utils.mailer.get_connection', return_value=connection):
            sender.run()

        # Leaving a closed connection behind would make later sends fail
        assert sender.connection is None

    def test_live_connection_is_alive(self):
        connection = MagicMock()
        connection.connection.noop.return_value = (250, b'OK')

        assert is_connection_alive(connection) is True

    def test_dropped_connection_is_not_alive(self):
        connection = MagicMock()
        connection.connection.noop.side_effect = SMTPServerDisconnected()

        assert is_connection_alive(connection) is False

    def test_unopened_connection_is_not_alive(self):
        connection = MagicMock()
        connection.connection = None

        assert is_connection_alive(connection) is False

    def test_non_smtp_backend_is_always_alive(self):
        # File and console backends hold no socket that could have dropped
        connection = Mock(spec=[])

        assert is_connection_alive(connection) is True

    def test_reset_connection_reopens_in_place(self):
        connection = MagicMock()

        reset_connection(connection)

        assert connection.close.call_count == 1
        assert connection.open.call_count == 1

    def test_reset_connection_reopens_despite_a_closing_error(self):
        connection = MagicMock()
        connection.close.side_effect = SMTPServerDisconnected()

        reset_connection(connection)

        assert connection.open.call_count == 1
