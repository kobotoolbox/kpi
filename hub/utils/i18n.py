# coding: utf-8
from django.db.models import Q
from django.db.models.functions import Length
from django.utils.translation import get_language

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
