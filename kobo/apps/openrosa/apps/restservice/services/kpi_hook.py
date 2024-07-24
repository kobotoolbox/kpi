# coding: utf-8
import logging
import re

import requests
from django.conf import settings
from kobo.apps.openrosa.apps.restservice.RestServiceInterface import RestServiceInterface
from kobo.apps.openrosa.apps.logger.models import Instance


class ServiceDefinition(RestServiceInterface):
    id = 'kpi_hook'
    verbose_name = 'KPI Hook POST'

    def send(self, endpoint, data):

        # Will be used internally by KPI to fetch data with KoBoCatBackend
        post_data = {
            'submission_id': data.get('instance_id')
        }
        headers = {'Content-Type': 'application/json'}

        # Verify if endpoint starts with `/assets/` before sending
        # the request to KPI
        pattern = r'{}'.format(settings.KPI_HOOK_ENDPOINT_PATTERN.replace(
            '{asset_uid}', '[^/]*'))

        # Match v2 and v1 endpoints.
        if re.match(pattern, endpoint) or re.match(pattern[7:], endpoint):
            # Build the url in the service to avoid saving hardcoded
            # domain name in the DB
            url = f'{settings.KOBOFORM_INTERNAL_URL}{endpoint}'
            response = requests.post(url, headers=headers, json=post_data)
            response.raise_for_status()

            # Save successful
            Instance.objects.filter(pk=data.get('instance_id')).update(
                posted_to_kpi=True
            )
        else:
            logging.warning(
                f'This endpoint: `{endpoint}` is not valid for `KPI Hook`'
            )
