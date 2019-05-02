# -*- coding: utf-8 -*-
from __future__ import unicode_literals, absolute_import

from rest_framework.response import Response
from rest_framework.views import APIView

import constance


class EnvironmentView(APIView):
    """ GET-only view for certain server-provided configuration data """

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
        `CONFIGS_TO_EXPOSE`
        """
        return Response({
            key.lower(): getattr(constance.config, key)
                for key in self.CONFIGS_TO_EXPOSE
        })
