from __future__ import annotations

from functools import wraps
from smtplib import (
    SMTPException,
    SMTPRecipientsRefused,
    SMTPResponseException,
)
from time import monotonic
from typing import Optional, Union

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection, send_mail
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail.backends.smtp import EmailBackend as UpstreamEmailBackend
from django.template.loader import get_template
from django.utils.translation import activate
from django.utils.translation import gettext as t

from kpi.exceptions import (
    MailerConnectionSessionLimitError,
    MailerError,
    MailerProviderQuotaExhaustedError,
    MailerProviderRateThrottledError,
)
from kpi.utils.log import logging


def with_smtp_connection(func):
    """
    Open a single connection for the whole duration of the decorated method

    The connection is exposed as `self.connection` and closed on the way out.
    Without it, every message goes through `send_mail()`, which opens and tears
    down a connection per email. That handshake caps the real throughput far
    below what the provider allows and makes large sends run into their task
    time limit.
    """

    @wraps(func)
    def wrapper(self, *args, **kwargs):
        # `get_connection()` instantiates `settings.EMAIL_BACKEND`, so it either
        # returns a backend or raises before the assignment. Every backend
        # inherits `open()` and `close()` from `BaseEmailBackend`, where they
        # are no-ops for the ones holding no socket.
        self.connection = get_connection()
        self.connection.open()
        try:
            return func(self, *args, **kwargs)
        finally:
            try:
                self.connection.close()
            except Exception as e:
                logging.warning(f'Error while closing the email connection: {e}')
            self.connection = None

    return wrapper


class EmailBackend(UpstreamEmailBackend):

    def _send(self, email_message):

        # Always inject the SES config set header
        config_set = settings.AWS_SES_CONFIGURATION_SET

        if config_set:
            email_message.extra_headers = email_message.extra_headers or {}
            email_message.extra_headers.setdefault(
                'X-SES-CONFIGURATION-SET',
                config_set,
            )

        return super()._send(email_message)


class EmailMessage:

    def __init__(
        self,
        to: Union[str, list],
        subject: str,
        plain_text_content_or_template: str,
        template_variables: dict | None = None,
        html_content_or_template: str | None = None,
        language: str | None = None,
        from_: str | None = None,
    ):
        default_language = settings.LANGUAGE_CODE

        self.to = to
        if isinstance(to, str):
            self.to = [to]

        self.from_ = settings.DEFAULT_FROM_EMAIL if not from_ else from_

        if language:
            # Localize templates
            activate(language)

        self.subject = t(subject)

        if template_variables is None:
            self.text_message = plain_text_content_or_template
        else:
            self.text_message = get_template(
                plain_text_content_or_template
            ).render(template_variables)

        self.html_message = None

        if html_content_or_template:
            self.html_message = (
                html_content_or_template
                if not template_variables
                else get_template(html_content_or_template).render(
                    template_variables
                )
            )

        if language:
            activate(default_language)

    def to_multi_alternative(self):
        message = EmailMultiAlternatives(
            self.subject, self.text_message, self.from_, self.to
        )
        if self.html_message:
            message.attach_alternative(self.html_message, 'text/html')
        return message


class Mailer:

    SMTP_ALIVE_STATUS_CODE = 250

    # (status code or None, substring to match in the response text,
    # exception to raise). Checked in order, first match wins. `None` for
    # the code means "match on text alone" - used where a provider's docs
    # don't pin down a single reliable leading SMTP code. The code alone is
    # never enough on its own either: SES returns the same 454 for both a
    # transient rate limit and an exhausted daily quota, distinguished only
    # by wording.
    #
    # Sources:
    # - SES: https://docs.aws.amazon.com/ses/latest/dg/manage-sending-quotas-errors.html
    # - SendGrid: https://twilio.com/docs/sendgrid/for-developers/sending-email/smtp-errors-and-troubleshooting  # noqa
    # - Office365/Exchange: https://learn.microsoft.com/en-us/troubleshoot/exchange/email-delivery/ndr/non-delivery-reports-in-exchange-online.  # noqa
    #   Enhanced codes there are listed without a paired basic SMTP code; 550
    #   is Microsoft's documented convention for a 5.x.x enhanced code
    #   returned live at submission time.
    #
    # An unmatched response keeps today's plain failure behavior
    # (`MailerError`), no pause.
    THROTTLE_SIGNATURES = (
        # AWS
        (454, 'Daily message quota', MailerProviderQuotaExhaustedError),
        (454, 'Maximum sending rate', MailerProviderRateThrottledError),
        # SendGrid
        (451, 'Maximum credits exceeded', MailerProviderQuotaExhaustedError),
        (450, 'too frequent connects', MailerProviderRateThrottledError),
        (
            452,
            'Too many recipients received this hour',
            MailerProviderRateThrottledError,
        ),
        (421, 'temporarily deferred', MailerProviderRateThrottledError),
        (
            421,
            'Maximum message count per session reached',
            MailerConnectionSessionLimitError,
        ),
        # Office365
        (None, 'Submission quota exceeded', MailerProviderQuotaExhaustedError),
        (None, 'reached your daily limit', MailerProviderQuotaExhaustedError),
        (None, 'per hour message receive limit', MailerProviderRateThrottledError),
    )

    @classmethod
    def send(
        cls,
        email_messages: Union[EmailMessage, list[EmailMessage]],
        connection: Optional[BaseEmailBackend] = None,
        idle_timeout: Optional[float] = None,
    ) -> None:
        """
        Send one or several messages, optionally reusing an existing connection.

        Raises a `MailerError` (or a more specific subclass, e.g.
        `MailerProviderRateThrottledError`) on failure instead of returning a bool,
        so callers can react to *why* a send failed rather than treating
        every failure the same way. Returns normally on success.

        When `connection` is omitted, a new one is opened and closed for every
        call, which costs a full SMTP handshake per message. Callers sending in
        bulk should open a connection once and pass it in: Django only closes
        the connection it opened itself, so an already-open one stays up across
        calls and each message still reports its own success.

        `idle_timeout`, only meaningful alongside a reused `connection`,
        proactively checks and repairs a connection that has sat idle longer
        than the given number of seconds before attempting the send, rather
        than discovering it is dead after the fact.
        """

        if connection is not None and idle_timeout is not None:
            cls._reopen_if_idle(connection, idle_timeout)

        if isinstance(email_messages, EmailMessage):
            cls._send_single(email_messages, connection)
        else:
            cls._send_batch(email_messages, connection)

        if connection is not None:
            connection._mailer_last_used = monotonic()

    @classmethod
    def _classify_smtp_exception(
        cls, exc: Union[SMTPException, OSError]
    ) -> MailerError:
        """
        Turn a raw `smtplib`/socket exception into a typed `MailerError`

        Only exceptions that carry an SMTP status code can be matched against
        `THROTTLE_SIGNATURES`. Everything else (e.g. a dropped connection)
        becomes a plain `MailerError`.
        """

        if isinstance(exc, SMTPRecipientsRefused):
            # One (code, message) pair per recipient. Every caller here sends to
            # a single recipient, so the first refusal is the only one that matters.
            code, msg = next(iter(exc.recipients.values()))
        elif isinstance(exc, SMTPResponseException):
            code, msg = exc.smtp_code, exc.smtp_error
        else:
            return MailerError(str(exc))

        text = cls._decode_smtp_text(msg)
        text_lower = text.lower()
        for signature_code, substring, exception_class in cls.THROTTLE_SIGNATURES:
            if (
                signature_code is None or code == signature_code
            ) and substring.lower() in text_lower:
                return exception_class(f'{code} {text}')

        return MailerError(f'{code} {text}')

    @staticmethod
    def _decode_smtp_text(value: Union[bytes, str]) -> str:
        if isinstance(value, bytes):
            return value.decode('utf-8', errors='replace')
        return str(value)

    @staticmethod
    def _dispatch_single(
        email_message: EmailMessage, connection: Optional[BaseEmailBackend]
    ):
        send_mail(
            email_message.subject,
            email_message.text_message,
            email_message.from_,
            email_message.to,
            html_message=email_message.html_message,
            fail_silently=False,
            connection=connection,
        )

    @classmethod
    def _is_connection_alive(cls, connection: BaseEmailBackend) -> bool:
        """
        Tell whether the connection can still carry another message

        `Mailer.send()` raises on every SMTP error, so callers wrapping it
        with a reused connection need this to tell a dropped socket apart
        from a message the server merely refused. Only the former is worth
        reconnecting for: a refused recipient leaves the connection perfectly
        usable, and tearing it down would cost a full handshake on every
        failure.
        """

        if not hasattr(connection, 'connection'):
            # Not an SMTP backend. The file and console backends used outside
            # production hold no socket that could have dropped.
            return True

        if connection.connection is None:
            return False

        try:
            code, _ = connection.connection.noop()
        except (OSError, SMTPException):
            return False

        return code == cls.SMTP_ALIVE_STATUS_CODE

    @classmethod
    def _reopen_if_idle(cls, connection: BaseEmailBackend, idle_timeout: float):
        last_used = getattr(connection, '_mailer_last_used', None)
        if last_used is None or monotonic() - last_used <= idle_timeout:
            return
        if not cls._is_connection_alive(connection):
            logging.warning(
                'SMTP connection idle past timeout, reconnecting proactively'
            )
            cls._reset_connection(connection)

    @staticmethod
    def _reset_connection(connection: BaseEmailBackend):
        """
        Close and reopen a connection in place

        Django leaves a connection it did not open itself untouched, so a
        socket dropped mid-run stays broken until it is explicitly replaced.
        Only the underlying socket is renewed, so callers holding this
        backend keep a valid reference.
        """

        try:
            connection.close()
        except Exception as e:
            # Django re-raises when quitting a socket that has already
            # dropped, which would mask the error that led us here in the
            # first place.
            logging.warning(f'Error while closing the email connection: {e}')

        connection.open()

    @classmethod
    def _send_batch(
        cls,
        email_messages: list[EmailMessage],
        connection: Optional[BaseEmailBackend],
    ):
        # Django `send_mass_mail()` does not support HTML
        messages = [em.to_multi_alternative() for em in email_messages]
        try:
            if connection is not None:
                connection.send_messages(messages)
            else:
                with get_connection() as new_connection:
                    new_connection.send_messages(messages)
        except (SMTPException, OSError) as e:
            # No retry here: Django's `send_messages()` gives no per-message
            # success/failure back, so retrying a partially-sent batch risks
            # re-sending messages that already went out.
            raise cls._classify_smtp_exception(e) from e

    @classmethod
    def _send_single(
        cls, email_message: EmailMessage, connection: Optional[BaseEmailBackend]
    ):
        try:
            cls._dispatch_single(email_message, connection)
        except (SMTPException, OSError) as e:
            if connection is not None and not cls._is_connection_alive(connection):
                # A dropped connection can happen right after the server
                # already accepted the message but before we read its
                # acknowledgement, so we can't tell a lost send apart from a
                # lost confirmation. Resending would risk a duplicate: just
                # reconnect for the records still to come and report this
                # one failed.
                logging.warning('SMTP connection lost, reconnecting')
                cls._reset_connection(connection)
            raise cls._classify_smtp_exception(e) from e
