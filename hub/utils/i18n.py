# coding: utf-8
from __future__ import annotations

import copy
import json
import logging

from constance import config
from django.db.models import Q
from django.db.models.functions import Length
from django.utils.translation import get_language, gettext as t
from django_request_cache import cache_for_request

from kobo.apps.constance_backends.utils import to_python_object
from kobo.static_lists import (
    PROJECT_METADATA_DEFAULT_LABELS,
    USER_METADATA_DEFAULT_LABELS
)
from kpi.utils.log import logging
from ..models import SitewideMessage


class I18nUtils:
    @staticmethod
    def get_custom_password_help_text(lang=None):
        # Get default value if lang is not specified
        language = lang if lang else get_language()

        try:
            messages_dict = to_python_object(
                config.CUSTOM_PASSWORD_GUIDANCE_TEXT
            )
        except json.JSONDecodeError:
            logging.error(
                'Configuration value for CUSTOM_PASSWORD_GUIDANCE_TEXT has '
                'invalid JSON'
            )
            # Given the validation done in the django admin interface, this
            # is an acceptable, low-likelihood evil
            return ''
        try:
            message = messages_dict[language]
        except KeyError:
            # Fall back to a default, which could be either:
            #   * A static string from `CONSTANCE_CONFIG`, which itself is
            #     translated, or,
            #   * The superuser's customized default.
            # If it's the former, calling `t()` will return a translated string
            # (if available) from the Django gettext machinery. If it's the
            # latter, then `t()` won't do anything useful, but it won't hurt
            # either
            message = t(messages_dict['default'])

        return message

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
        sitewide_message = (
            SitewideMessage.objects.filter(
                Q(slug=f'{slug}_{language}') | Q(slug=slug)
            )
            .order_by(Length('slug').desc())
            .first()
        )

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

        try:
            messages_dict = to_python_object(config.MFA_LOCALIZED_HELP_TEXT)
        except json.JSONDecodeError:
            logging.error(
                'Configuration value for MFA_LOCALIZED_HELP_TEXT has invalid '
                'JSON'
            )
            # Given the validation done in the django admin interface, this
            # is an acceptable, low-likelihood evil
            return ''
        try:
            message = messages_dict[language]
        except KeyError:
            # Fall back to a default, which could be either:
            #   * A static string from `CONSTANCE_CONFIG`, which itself is
            #     translated, or,
            #   * The superuser's customized default.
            # If it's the former, calling `t()` will return a translated string
            # (if available) from the Django gettext machinery. If it's the
            # latter, then `t()` won't do anything useful, but it won't hurt
            # either
            message = t(messages_dict['default'])

        message = message.replace('##support email##', config.SUPPORT_EMAIL)
        return message

    @classmethod
    def get_metadata_field_label(
        cls, field_name: str, field_type: str, lang: str = None
    ):
        metadata_fields = {
            field['name']: field
            for field in cls.get_metadata_fields(
                fields_type=field_type, lang=lang
            )
        }
        return metadata_fields[field_name]['label']

    @classmethod
    @cache_for_request
    def get_metadata_fields(
        cls, fields_type: str, lang: str = None
    ) -> list[dict]:
        """
        Returns custom labels and translations for the metadata fields depending
        on `metadata_fields_type` value (i.e. 'user' or 'project')
        """
        (
            metadata_fields,
            default_labels,
        ) = cls._get_metadata_fields_and_default_labels(fields_type)

        language = lang if lang else get_language()

        # Check if each user metadata has a label
        for metadata_field in metadata_fields:
            if 'label' in metadata_field.keys():
                cls._set_metadata_field_custom_label(
                    metadata_field, default_labels, language
                )
            else:
                # If label is not available, use the default from static_list.py
                # in `USER_METADATA_DEFAULT_LABELS` or `PROJECT_METADATA_DEFAULT_LABELS
                try:
                    metadata_field['label'] = default_labels[metadata_field['name']]
                except KeyError:
                    continue

        return metadata_fields

    @classmethod
    def _get_metadata_fields_and_default_labels(
        cls, fields_type: str
    ) -> tuple:

        if fields_type == 'user':
            return (
                copy.deepcopy(to_python_object(config.USER_METADATA_FIELDS)),
                USER_METADATA_DEFAULT_LABELS,
            )
        else:
            return (
                copy.deepcopy(to_python_object(config.PROJECT_METADATA_FIELDS)),
                PROJECT_METADATA_DEFAULT_LABELS,
            )

    @staticmethod
    def _set_metadata_field_custom_label(
        field: dict, default_label_dict: dict, language: str,
    ):
        """
        Returns the translated label of the metadata fields
        """
        # Check to see if label exists
        try:
            label = field['label']
            try:
                translation = label[language]
            except KeyError:
                # Use the default value if language is not available
                translation = label['default']
        except KeyError:
            # Use kobo translated version
            translation = default_label_dict[field['name']]

        field['label'] = translation
