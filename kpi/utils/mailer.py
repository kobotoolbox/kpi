from __future__ import annotations

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
