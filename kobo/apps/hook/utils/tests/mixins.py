import json

import pytest
import responses
from django.urls import reverse
from rest_framework import status

from kobo.apps.hook.constants import HOOK_LOG_FAILED
from kobo.apps.hook.exceptions import HookRemoteServerDownError
from kobo.apps.hook.models import HookLog
from kpi.constants import SUBMISSION_FORMAT_TYPE_JSON, SUBMISSION_FORMAT_TYPE_XML
from kpi.exceptions import BadFormatException


class HookTestCaseMixin:

    def _create_hook(self, return_response_only=False, **kwargs):

        format_type = kwargs.get('format_type', SUBMISSION_FORMAT_TYPE_JSON)
        if format_type not in [
            SUBMISSION_FORMAT_TYPE_JSON,
            SUBMISSION_FORMAT_TYPE_XML,
        ]:
            raise BadFormatException(
                'The format {} is not supported'.format(format_type)
            )

        self._add_submissions()

        url = reverse('hook-list', args=(self.asset.uid,))
        data = {
            'name': kwargs.get('name', 'some external service with token'),
            'endpoint': kwargs.get('endpoint', 'http://external.service.local/'),
            'settings': kwargs.get(
                'settings', {'custom_headers': {'X-Token': '1234abcd'}}
            ),
            'export_type': format_type,
            'active': kwargs.get('active', True),
            'subset_fields': kwargs.get('subset_fields', []),
            'payload_template': kwargs.get('payload_template', None),
        }

        response = self.client.post(url, data, format='json')
        if return_response_only:
            return response
        else:
            self.assertEqual(
                response.status_code, status.HTTP_201_CREATED, msg=response.data
            )
            hook = self.asset.hooks.last()
            self.assertTrue(hook.active)
            return hook

    def _send_and_fail(self) -> dict:
        """
        The public method which calls this method needs to be decorated by
        `@responses.activate`
        """

        first_hooklog_response = self._send_and_wait_for_retry()

        # Fakes Celery n retries by forcing status to `failed`
        # (where n is `settings.HOOKLOG_MAX_RETRIES`)
        first_hooklog = HookLog.objects.get(uid=first_hooklog_response.get('uid'))
        first_hooklog.change_status(HOOK_LOG_FAILED)

        return first_hooklog_response

    def _send_and_wait_for_retry(self):
        self.hook = self._create_hook()

        ServiceDefinition = self.hook.get_service_definition()
        submissions = self.asset.deployment.get_submissions(self.asset.owner)
        submission_id = submissions[0]['_id']
        service_definition = ServiceDefinition(self.hook, submission_id)
        first_mock_response = {'error': 'gateway timeout'}

        # Mock first request's try
        responses.add(
            responses.POST,
            self.hook.endpoint,
            json=first_mock_response,
            status=status.HTTP_504_GATEWAY_TIMEOUT,
        )

        # Mock next requests' tries
        responses.add(
            responses.POST,
            self.hook.endpoint,
            status=status.HTTP_200_OK,
            content_type='application/json',
        )

        # Try to send data to external endpoint
        with pytest.raises(HookRemoteServerDownError):
            service_definition.send()

        # Retrieve the corresponding log
        url = reverse(
            'hook-log-list',
            kwargs={
                'parent_lookup_asset': self.hook.asset.uid,
                'parent_lookup_hook': self.hook.uid,
            },
        )

        response = self.client.get(url)
        first_hooklog_response = response.data.get('results')[0]

        # Result should match first try
        self.assertEqual(
            first_hooklog_response.get('status_code'),
            status.HTTP_504_GATEWAY_TIMEOUT,
        )
        self.assertEqual(
            json.loads(first_hooklog_response.get('message')),
            first_mock_response,
        )
        return first_hooklog_response
