from __future__ import annotations

from typing import Union
from smtplib import SMTPException

from django.conf import settings
from django.core.mail import send_mail, EmailMultiAlternatives, get_connection
from django.template.loader import get_template
from django.utils.translation import activate, gettext as t

from kpi.utils.log import logging


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
    def send(cls, email_messages: Union[EmailMessage, List[EmailMessage]]) -> bool:
        if isinstance(email_messages, EmailMessage):
            try:
                send_mail(
                    email_messages.subject,
                    email_messages.text_message,
                    email_messages.from_,
                    email_messages.to,
                    html_message=email_messages.html_message,
                    fail_silently=False,
                )
            except SMTPException as e:
                logging.error(str(e), exc_info=True)
                return False
        else:
            # Django `send_mass_mail()` does not support HTML
            email_messages = [em.to_multi_alternative() for em in email_messages]
            try:
                with get_connection() as connection:
                    connection.send_messages(email_messages)
            except SMTPException as e:
                logging.error(str(e), exc_info=True)
                return False

        return True
