# -*- coding: utf-8 -*-
from __future__ import unicode_literals, absolute_import

import constance
from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import APIView

from kobo.static_lists import COUNTRIES, LANGUAGES, SECTORS


class EnvironmentView(APIView):
    """
    GET-only view for certain server-provided configuration data
    """

    CONFIGS_TO_EXPOSE = [
        'TERMS_OF_SERVICE_URL',
        'PRIVACY_POLICY_URL',
        'SOURCE_CODE_URL',
        'SUPPORT_URL',
        'SUPPORT_EMAIL',
    ]

    def get(self, request, *args, **kwargs):
        """
        Return the lowercased key and value of each setting in
        `CONFIGS_TO_EXPOSE`, along with the static lists of sectors, countries,
        all known languages, and languages for which the interface has
        translations.
        """
        data = {
            key.lower(): getattr(constance.config, key)
                for key in self.CONFIGS_TO_EXPOSE
        }
        data['available_sectors'] = SECTORS
        data['available_countries'] = COUNTRIES
        data['all_languages'] = LANGUAGES
        data['interface_languages'] = settings.LANGUAGES
        return Response(data)
