from smtplib import (
    SMTPException,
    SMTPRecipientsRefused,
    SMTPResponseException,
    SMTPServerDisconnected,
)
from time import monotonic
from unittest.mock import MagicMock, Mock, patch

from django.conf import settings
from django.core.mail import EmailMessage
from django.test import TestCase, override_settings

from kpi.exceptions import (
    MailerConnectionSessionLimitError,
    MailerError,
    MailerProviderQuotaExhaustedError,
    MailerProviderRateThrottledError,
)
from kpi.utils.mailer import EmailMessage as MailerEmailMessage
from kpi.utils.mailer import Mailer, with_smtp_connection


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

        assert Mailer._is_connection_alive(connection) is True

    def test_dropped_connection_is_not_alive(self):
        connection = MagicMock()
        connection.connection.noop.side_effect = SMTPServerDisconnected()

        assert Mailer._is_connection_alive(connection) is False

    def test_unopened_connection_is_not_alive(self):
        connection = MagicMock()
        connection.connection = None

        assert Mailer._is_connection_alive(connection) is False

    def test_non_smtp_backend_is_always_alive(self):
        # File and console backends hold no socket that could have dropped
        connection = Mock(spec=[])

        assert Mailer._is_connection_alive(connection) is True

    def test_reset_connection_reopens_in_place(self):
        connection = MagicMock()

        Mailer._reset_connection(connection)

        assert connection.close.call_count == 1
        assert connection.open.call_count == 1

    def test_reset_connection_reopens_despite_a_closing_error(self):
        connection = MagicMock()
        connection.close.side_effect = SMTPServerDisconnected()

        Mailer._reset_connection(connection)

        assert connection.open.call_count == 1


class TestClassifySmtpException(TestCase):
    """
    Cover how raw `smtplib` exceptions are turned into typed `MailerError`s.
    """

    def test_ses_rate_throttle_signature_matches(self):
        exc = SMTPResponseException(
            454, b'Throttling failure: Maximum sending rate exceeded.'
        )

        error = Mailer._classify_smtp_exception(exc)

        assert isinstance(error, MailerProviderRateThrottledError)
        assert not isinstance(error, MailerProviderQuotaExhaustedError)

    def test_ses_quota_throttle_signature_matches(self):
        exc = SMTPResponseException(
            454, b'Throttling failure: Daily message quota exceeded.'
        )

        error = Mailer._classify_smtp_exception(exc)

        assert isinstance(error, MailerProviderQuotaExhaustedError)
        assert not isinstance(error, MailerProviderRateThrottledError)

    def test_signature_matches_regardless_of_response_text_casing(self):
        exc = SMTPResponseException(
            454, b'Throttling failure: DAILY MESSAGE QUOTA exceeded.'
        )

        error = Mailer._classify_smtp_exception(exc)

        assert isinstance(error, MailerProviderQuotaExhaustedError)

    def test_sendgrid_too_frequent_connects_signature_matches(self):
        exc = SMTPResponseException(
            450, b'too frequent connects from 1.2.3.4, please try again later.'
        )

        error = Mailer._classify_smtp_exception(exc)

        assert isinstance(error, MailerProviderRateThrottledError)

    def test_sendgrid_hourly_throttle_signature_matches(self):
        exc = SMTPResponseException(
            452, b'Too many recipients received this hour (throttled)'
        )

        error = Mailer._classify_smtp_exception(exc)

        assert isinstance(error, MailerProviderRateThrottledError)

    def test_sendgrid_temporarily_deferred_signature_matches(self):
        exc = SMTPResponseException(421, b'Message from (1.2.3.4) temporarily deferred')

        error = Mailer._classify_smtp_exception(exc)

        assert isinstance(error, MailerProviderRateThrottledError)

    def test_ses_max_message_count_per_session_signature_matches(self):
        exc = SMTPResponseException(
            421,
            b'Connection closed by server. Maximum message count per '
            b'session reached.',
        )

        error = Mailer._classify_smtp_exception(exc)

        assert isinstance(error, MailerConnectionSessionLimitError)
        assert not isinstance(error, MailerProviderRateThrottledError)

    def test_sendgrid_credits_exceeded_signature_matches(self):
        exc = SMTPResponseException(
            451, b'Authentication failed: Maximum credits exceeded'
        )

        error = Mailer._classify_smtp_exception(exc)

        assert isinstance(error, MailerProviderQuotaExhaustedError)

    def test_office365_submission_quota_exceeded_signature_matches(self):
        exc = SMTPResponseException(550, b'5.2.2 Submission quota exceeded')

        error = Mailer._classify_smtp_exception(exc)

        assert isinstance(error, MailerProviderQuotaExhaustedError)

    def test_office365_daily_recipient_limit_signature_matches(self):
        exc = SMTPResponseException(
            550,
            b"5.1.90 Your message can't be sent because you've reached your "
            b"daily limit for message recipients",  # noqa Q000
        )

        error = Mailer._classify_smtp_exception(exc)

        assert isinstance(error, MailerProviderQuotaExhaustedError)

    def test_office365_recipient_hourly_limit_from_sender_signature_matches(self):
        exc = SMTPResponseException(
            550,
            b"5.2.121 Recipient's per hour message receive limit from "
            b"specific sender exceeded",  # noqa Q000
        )

        error = Mailer._classify_smtp_exception(exc)

        assert isinstance(error, MailerProviderRateThrottledError)

    def test_office365_recipient_hourly_limit_signature_matches(self):
        exc = SMTPResponseException(
            550, b"5.2.122 Recipient's per hour message receive limit exceeded"
        )

        error = Mailer._classify_smtp_exception(exc)

        assert isinstance(error, MailerProviderRateThrottledError)

    def test_office365_unrelated_access_denied_does_not_match(self):
        # Office365 has several unrelated 550 messages (e.g. a
        # compromised/blocked account); only the catalogued phrasings above
        # are throttling/quota signals.
        exc = SMTPResponseException(550, b'Access denied, bad outbound sender')

        error = Mailer._classify_smtp_exception(exc)

        assert type(error) is MailerError

    def test_unmatched_code_falls_back_to_plain_error(self):
        exc = SMTPResponseException(550, b'Mailbox unavailable')

        error = Mailer._classify_smtp_exception(exc)

        assert type(error) is MailerError

    def test_unmatched_text_on_a_catalogued_code_falls_back_to_plain_error(self):
        exc = SMTPResponseException(454, b'Some other transient failure')

        error = Mailer._classify_smtp_exception(exc)

        assert type(error) is MailerError

    def test_smtp_recipients_refused_uses_the_recipient_code(self):
        exc = SMTPRecipientsRefused(
            {'to@example.com': (454, b'Maximum sending rate exceeded.')}
        )

        error = Mailer._classify_smtp_exception(exc)

        assert isinstance(error, MailerProviderRateThrottledError)

    def test_connection_level_exception_returns_a_plain_error(self):
        exc = SMTPServerDisconnected('Connection unexpectedly closed')

        error = Mailer._classify_smtp_exception(exc)

        assert type(error) is MailerError

    def test_text_is_decoded_whether_bytes_or_str(self):
        exc = SMTPResponseException(454, 'Maximum sending rate exceeded.')

        error = Mailer._classify_smtp_exception(exc)

        assert isinstance(error, MailerProviderRateThrottledError)


class TestMailerSendSingle(TestCase):
    """
    Cover `Mailer.send()` for a single `EmailMessage`.
    """

    def setUp(self):
        self.message = MailerEmailMessage(
            to='to@example.com',
            subject='Subject',
            plain_text_content_or_template='Body',
        )

    def test_send_succeeds_without_raising(self):
        with patch('kpi.utils.mailer.send_mail') as send_mail_mock:
            Mailer.send(self.message)

        send_mail_mock.assert_called_once()

    def test_no_connection_raises_immediately_without_retry(self):
        with (
            patch(
                'kpi.utils.mailer.send_mail',
                side_effect=SMTPResponseException(550, b'Mailbox unavailable'),
            ) as send_mail_mock,
            self.assertRaises(MailerError),
        ):
            Mailer.send(self.message)

        # No connection was passed in, so there is nothing to reconnect
        send_mail_mock.assert_called_once()

    def test_refused_recipient_does_not_reset_the_connection(self):
        connection = MagicMock()
        with (
            patch(
                'kpi.utils.mailer.send_mail',
                side_effect=SMTPResponseException(550, b'Mailbox unavailable'),
            ) as send_mail_mock,
            patch('kpi.utils.mailer.Mailer._is_connection_alive', return_value=True),
            patch('kpi.utils.mailer.Mailer._reset_connection') as reset_mock,
            self.assertRaises(MailerError),
        ):
            Mailer.send(self.message, connection=connection)

        assert reset_mock.call_count == 0
        assert send_mail_mock.call_count == 1

    def test_dead_connection_is_reset_but_the_message_is_not_retried(self):
        # A dropped connection can happen right after the server already
        # accepted the message but before we read its acknowledgement, so a
        # resend risks a duplicate (see DEV-2675/PR #7435). The connection is
        # still repaired for the records still to come.
        connection = MagicMock()
        with (
            patch(
                'kpi.utils.mailer.send_mail',
                side_effect=SMTPServerDisconnected(),
            ) as send_mail_mock,
            patch('kpi.utils.mailer.Mailer._is_connection_alive', return_value=False),
            patch('kpi.utils.mailer.Mailer._reset_connection') as reset_mock,
            self.assertRaises(MailerError),
        ):
            Mailer.send(self.message, connection=connection)

        assert reset_mock.call_count == 1
        assert send_mail_mock.call_count == 1

    def test_dropped_socket_is_reset_and_classified_as_a_plain_error(self):
        # A raw OSError (e.g. ConnectionResetError) carries no SMTP status
        # code, but is still a dropped-connection signal like SMTPServerDisconnected.
        connection = MagicMock()
        with (
            patch(
                'kpi.utils.mailer.send_mail',
                side_effect=ConnectionResetError(),
            ) as send_mail_mock,
            patch('kpi.utils.mailer.Mailer._is_connection_alive', return_value=False),
            patch('kpi.utils.mailer.Mailer._reset_connection') as reset_mock,
            self.assertRaises(MailerError),
        ):
            Mailer.send(self.message, connection=connection)

        assert reset_mock.call_count == 1
        assert send_mail_mock.call_count == 1

    def test_throttled_signature_propagates_its_specific_type(self):
        connection = MagicMock()
        with (
            patch(
                'kpi.utils.mailer.send_mail',
                side_effect=SMTPResponseException(
                    454, b'Throttling failure: Maximum sending rate exceeded.'
                ),
            ),
            patch('kpi.utils.mailer.Mailer._is_connection_alive', return_value=True),
            patch('kpi.utils.mailer.Mailer._reset_connection') as reset_mock,
        ):
            with self.assertRaises(MailerProviderRateThrottledError):
                Mailer.send(self.message, connection=connection)

        # A throttled message is not a dropped connection, no reconnecting
        assert reset_mock.call_count == 0

    def test_send_updates_the_connection_last_used_timestamp(self):
        connection = MagicMock(spec=[])

        with patch('kpi.utils.mailer.send_mail'):
            Mailer.send(self.message, connection=connection)

        assert isinstance(connection._mailer_last_used, float)


class TestMailerSendBatch(TestCase):
    """
    Cover `Mailer.send()` for a list of `EmailMessage`s.
    """

    def setUp(self):
        self.messages = [
            MailerEmailMessage(
                to='to@example.com',
                subject='Subject',
                plain_text_content_or_template='Body',
            )
        ]

    def test_batch_send_succeeds_without_raising(self):
        connection = MagicMock()

        Mailer.send(self.messages, connection=connection)

        connection.send_messages.assert_called_once()

    def test_batch_failure_is_not_retried(self):
        connection = MagicMock()
        connection.send_messages.side_effect = SMTPResponseException(
            454, b'Throttling failure: Maximum sending rate exceeded.'
        )

        with (
            patch('kpi.utils.mailer.Mailer._is_connection_alive') as alive_mock,
            patch('kpi.utils.mailer.Mailer._reset_connection') as reset_mock,
            self.assertRaises(MailerProviderRateThrottledError),
        ):
            Mailer.send(self.messages, connection=connection)

        # The batch branch never probes or resets: retrying risks
        # re-sending messages that already went out earlier in the list
        assert alive_mock.call_count == 0
        assert reset_mock.call_count == 0
        assert connection.send_messages.call_count == 1

    def test_batch_dropped_socket_is_classified_as_a_plain_error(self):
        connection = MagicMock()
        connection.send_messages.side_effect = ConnectionResetError()

        with (
            patch('kpi.utils.mailer.Mailer._is_connection_alive') as alive_mock,
            patch('kpi.utils.mailer.Mailer._reset_connection') as reset_mock,
            self.assertRaises(MailerError),
        ):
            Mailer.send(self.messages, connection=connection)

        assert alive_mock.call_count == 0
        assert reset_mock.call_count == 0
        assert connection.send_messages.call_count == 1


class TestMailerIdleTimeout(TestCase):
    """
    Cover the proactive idle-timeout check on a reused connection.
    """

    def test_reopen_if_idle_skips_when_never_used(self):
        connection = MagicMock(spec=[])

        with patch('kpi.utils.mailer.Mailer._is_connection_alive') as alive_mock:
            Mailer._reopen_if_idle(connection, idle_timeout=10)

        assert alive_mock.call_count == 0

    def test_reopen_if_idle_skips_within_the_timeout(self):
        connection = MagicMock(spec=[])
        connection._mailer_last_used = monotonic()

        with patch('kpi.utils.mailer.Mailer._is_connection_alive') as alive_mock:
            Mailer._reopen_if_idle(connection, idle_timeout=10)

        assert alive_mock.call_count == 0

    def test_reopen_if_idle_resets_a_stale_dead_connection(self):
        connection = MagicMock(spec=[])
        connection._mailer_last_used = monotonic() - 20

        with (
            patch('kpi.utils.mailer.Mailer._is_connection_alive', return_value=False),
            patch('kpi.utils.mailer.Mailer._reset_connection') as reset_mock,
        ):
            Mailer._reopen_if_idle(connection, idle_timeout=10)

        assert reset_mock.call_count == 1

    def test_reopen_if_idle_leaves_a_stale_but_alive_connection_untouched(self):
        connection = MagicMock(spec=[])
        connection._mailer_last_used = monotonic() - 20

        with (
            patch('kpi.utils.mailer.Mailer._is_connection_alive', return_value=True),
            patch('kpi.utils.mailer.Mailer._reset_connection') as reset_mock,
        ):
            Mailer._reopen_if_idle(connection, idle_timeout=10)

        assert reset_mock.call_count == 0

    def test_send_proactively_reopens_a_stale_connection_before_sending(self):
        connection = MagicMock(spec=[])
        connection._mailer_last_used = monotonic() - 20
        message = MailerEmailMessage(
            to='to@example.com',
            subject='Subject',
            plain_text_content_or_template='Body',
        )

        with (
            patch('kpi.utils.mailer.Mailer._is_connection_alive', return_value=False),
            patch('kpi.utils.mailer.Mailer._reset_connection') as reset_mock,
            patch('kpi.utils.mailer.send_mail'),
        ):
            Mailer.send(message, connection=connection, idle_timeout=10)

        assert reset_mock.call_count == 1
