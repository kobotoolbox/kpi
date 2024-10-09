# coding: utf-8
import json
import uuid

import pytest
import responses
from django.conf import settings
from django.urls import reverse
from rest_framework import status

from kpi.constants import SUBMISSION_FORMAT_TYPE_JSON, SUBMISSION_FORMAT_TYPE_XML
from kpi.exceptions import BadFormatException
from kpi.tests.kpi_test_case import KpiTestCase
from ..constants import HOOK_LOG_FAILED
from ..exceptions import HookRemoteServerDownError
from ..models import Hook, HookLog


class HookTestCase(KpiTestCase):

    def setUp(self):
        self.client.login(username='someuser', password='someuser')
        self.asset = self.create_asset(
            'some_asset',
            content=json.dumps(
                {
                    'survey': [
                        {'type': 'text', 'label': 'q1', 'name': 'q1'},
                        {'type': 'begin_group', 'label': 'group1', 'name': 'group1'},
                        {'type': 'text', 'label': 'q2', 'name': 'q2'},
                        {'type': 'text', 'label': 'q3', 'name': 'q3'},
                        {'type': 'end_group'},
                        {'type': 'begin_group', 'label': 'group2', 'name': 'group2'},
                        {
                            'type': 'begin_group',
                            'label': 'subgroup1',
                            'name': 'subgroup1',
                        },
                        {'type': 'text', 'label': 'q4', 'name': 'q4'},
                        {'type': 'text', 'label': 'q5', 'name': 'q5'},
                        {'type': 'text', 'label': 'q6', 'name': 'q6'},
                        {'type': 'end_group'},
                        {'type': 'end_group'},
                    ]
                }
            ),
            format='json',
        )
        self.asset.deploy(backend='mock', active=True)
        self.asset.save()
        self.hook = Hook()
        self._submission_pk = 1

        settings.CELERY_TASK_ALWAYS_EAGER = True

    def _create_hook(self, return_response_only=False, **kwargs):

        format_type = kwargs.get('format_type', SUBMISSION_FORMAT_TYPE_JSON)
        if format_type not in [
            SUBMISSION_FORMAT_TYPE_JSON,
            SUBMISSION_FORMAT_TYPE_XML,
        ]:
            raise BadFormatException(
                'The format {} is not supported'.format(format_type)
            )

        self.__prepare_submission()

        url = reverse('hook-list', args=(self.asset.uid,))
        data = {
            'name': kwargs.get('name', 'some external service with token'),
            'endpoint': kwargs.get('endpoint', 'http://external.service.local/'),
            'settings': kwargs.get('settings', {
                'custom_headers': {
                    'X-Token': '1234abcd'
                }
            }),
            'export_type': format_type,
            'active': kwargs.get('active', True),
            'subset_fields': kwargs.get('subset_fields', []),
            'payload_template': kwargs.get('payload_template', None)
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

    def _send_and_fail(self):
        """
        The public method which calls this method needs to be decorated by
        `@responses.activate`

        :return: dict
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
        url = reverse('hook-log-list', kwargs={
            'parent_lookup_asset': self.hook.asset.uid,
            'parent_lookup_hook': self.hook.uid
        })

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

    def __prepare_submission(self):
        v_uid = self.asset.latest_deployed_version.uid
        self.submission = {
            '__version__': v_uid,
            'q1': '¿Qué tal?',
            '_uuid': str(uuid.uuid4()),
            'group1/q2': '¿Cómo está en el grupo uno la primera vez?',
            'group1/q3': '¿Cómo está en el grupo uno la segunda vez?',
            'group2/subgroup1/q4': '¿Cómo está en el subgrupo uno la primera vez?',
            'group2/subgroup1/q5': '¿Cómo está en el subgrupo uno la segunda vez?',
            'group2/subgroup1/q6': '¿Cómo está en el subgrupo uno la tercera vez?',
            'group2/subgroup11/q1': '¿Cómo está en el subgrupo once?',
        }
        self.asset.deployment.mock_submissions([self.submission])
