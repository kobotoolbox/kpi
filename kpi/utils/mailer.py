from __future__ import annotations

from functools import wraps
from smtplib import SMTPException
from typing import Optional, Union

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection, send_mail
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail.backends.smtp import EmailBackend as UpstreamEmailBackend
from django.template.loader import get_template
from django.utils.translation import activate
from django.utils.translation import gettext as t

from kpi.utils.log import logging

SMTP_ALIVE_STATUS_CODE = 250


def is_connection_alive(connection: BaseEmailBackend) -> bool:
    """
    Tell whether the connection can still carry another message

    `Mailer.send()` reports every SMTP error as a plain `False`, so the caller
    needs this to tell a dropped socket apart from a message the server merely
    refused. Only the former is worth reconnecting for: a refused recipient
    leaves the connection perfectly usable, and tearing it down would cost a
    full handshake on every failure.
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

    return code == SMTP_ALIVE_STATUS_CODE


def reset_connection(connection: BaseEmailBackend):
    """
    Close and reopen a connection in place

    Django leaves a connection it did not open itself untouched, so a socket
    dropped mid-run stays broken until it is explicitly replaced. Only the
    underlying socket is renewed, so callers holding this backend keep a valid
    reference.
    """

    try:
        connection.close()
    except Exception as e:
        # Django re-raises when quitting a socket that has already dropped,
        # which would mask the error that led us here in the first place.
        logging.warning(f'Error while closing the email connection: {e}')

    connection.open()


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
        template_variables: dict = None,
        html_content_or_template: str = None,
        language: str = None,
        from_: str = None,
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

    @classmethod
    def send(
        cls,
        email_messages: Union[EmailMessage, list[EmailMessage]],
        connection: Optional[BaseEmailBackend] = None,
    ) -> bool:
        """
        Send one or several messages, optionally reusing an existing connection.

        When `connection` is omitted, a new one is opened and closed for every
        call, which costs a full SMTP handshake per message. Callers sending in
        bulk should open a connection once and pass it in: Django only closes
        the connection it opened itself, so an already-open one stays up across
        calls and each message still reports its own success.
        """

        if isinstance(email_messages, EmailMessage):
            try:
                send_mail(
                    email_messages.subject,
                    email_messages.text_message,
                    email_messages.from_,
                    email_messages.to,
                    html_message=email_messages.html_message,
                    fail_silently=False,
                    connection=connection,
                )
            except SMTPException as e:
                logging.error(str(e), exc_info=True)
                return False
        else:
            # Django `send_mass_mail()` does not support HTML
            messages = [em.to_multi_alternative() for em in email_messages]
            try:
                if connection is not None:
                    connection.send_messages(messages)
                else:
                    with get_connection() as new_connection:
                        new_connection.send_messages(messages)
            except SMTPException as e:
                logging.error(str(e), exc_info=True)
                return False

        return True
