# coding: utf-8
import json

import constance
from django.conf import settings
from django.utils.translation import gettext_lazy as t
from rest_framework.response import Response
from rest_framework.views import APIView

from kobo.static_lists import COUNTRIES, LANGUAGES
from kobo.apps.hook.constants import SUBMISSION_PLACEHOLDER


class EnvironmentView(APIView):
    """
    GET-only view for certain server-provided configuration data
    """

    CONFIGS_TO_EXPOSE = [
        'TERMS_OF_SERVICE_URL',
        'PRIVACY_POLICY_URL',
        'SOURCE_CODE_URL',
        'SUPPORT_EMAIL',
        'SUPPORT_URL',
        'COMMUNITY_URL',
        'FRONTEND_MIN_RETRY_TIME',
        'FRONTEND_MAX_RETRY_TIME',
        ('PROJECT_METADATA_FIELDS', json.loads),
        ('USER_METADATA_FIELDS', json.loads),
        (
            'SECTOR_CHOICES',
            # Intentional t() call on dynamic string because the default
            # choices are translated (see static_lists.py)
            lambda text: tuple((line, t(line)) for line in text.split('\r\n')),
        ),
        (
            'OPERATIONAL_PURPOSE_CHOICES',
            lambda text: tuple((line, line) for line in text.split('\r\n')),
        ),
    ]

    def get(self, request, *args, **kwargs):
        """
        Return the lowercased key and value of each setting in
        `CONFIGS_TO_EXPOSE`, along with the static lists of sectors, countries,
        all known languages, and languages for which the interface has
        translations.
        """
        data = {}
        for key_or_key_and_callable in self.CONFIGS_TO_EXPOSE:
            try:
                key, processor = key_or_key_and_callable
            except ValueError:
                key = key_or_key_and_callable
                processor = None
            value = getattr(constance.config, key)
            if processor:
                value = processor(value)
            data[key.lower()] = value

        data['country_choices'] = COUNTRIES
        data['all_languages'] = LANGUAGES
        data['interface_languages'] = settings.LANGUAGES
        data['submission_placeholder'] = SUBMISSION_PLACEHOLDER
        return Response(data)
