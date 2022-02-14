# coding: utf-8
import json
import logging

import constance
from django.db.models import Q
from django.db.models.functions import Length
from django.utils.translation import get_language

from kpi.utils.log import logging
from ..models import SitewideMessage


class I18nUtils:

    @staticmethod
    def get_sitewide_message(slug="welcome_message", lang=None):
        """
        Returns a sitewide message based on its slug and the specified language.
        If the language is not specified, it will use the current language.
        If there are no results found, it falls back on the global version.
        It doesn't exist at all, it returns None.
        :param slug: str
        :param lang: str|None
        :return: MarkupField|None
        """

        # Get default value if lang is not specified
        language = lang if lang else get_language()

        # Let's retrieve messages where slug is either:
        #   - "<slug>_<locale>"
        #   - "<slug>"
        # We order the results by the length of the slug to be sure
        # localized version comes first.
        sitewide_message = SitewideMessage.objects\
            .filter(
                Q(slug="{}_{}".format(slug, language)) |
                Q(slug="{}".format(slug)))\
            .order_by(Length("slug").desc())\
            .first()

        if sitewide_message is not None:
            return sitewide_message.body

        return None

    @staticmethod
    def get_mfa_help_text(lang=None):
        """
        Returns a localized version of the text for MFA guidance
        """

        # Get default value if lang is not specified
        language = lang if lang else get_language()

        text = constance.config.MFA_I18N_HELP_TEXTS.replace(
            '##support email##',
            constance.config.SUPPORT_EMAIL,
        )
        try:
            i18n_mfa_help_texts = json.loads(text)
        except json.JSONDecodeError:
            logging.error('Could decode Constance.MFA_I18N_HELP_TEXTS')
            return ''

        default = i18n_mfa_help_texts['default']
        return i18n_mfa_help_texts.get(language, default)
