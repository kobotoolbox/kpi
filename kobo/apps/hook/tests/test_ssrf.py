# coding: utf-8
import constance
import responses
from mock import patch
from rest_framework import status

from kobo.apps.hook.constants import (
    HOOK_LOG_PENDING,
    KOBO_INTERNAL_ERROR_STATUS_CODE
)
from .hook_test_case import HookTestCase, MockSSRFProtect


class SSRFHookTestCase(HookTestCase):

    @patch('ssrf_protect.ssrf_protect.SSRFProtect._get_ip_address',
           new=MockSSRFProtect._get_ip_address)
    @responses.activate
    def test_send_with_ssrf_options(self):
        # Create first hook
        constance.config.SSRF_DENIED_IP_ADDRESS = '1.2.3.4'

        hook = self._create_hook()

        ServiceDefinition = hook.get_service_definition()
        submissions = self.asset.deployment.get_submissions(self.asset.owner)
        submission_id = submissions[0]['_id']
        service_definition = ServiceDefinition(hook, submission_id)
        first_mock_response = {'error': 'not found'}

        responses.add(responses.POST, hook.endpoint,
                      status=status.HTTP_200_OK,
                      content_type='application/json')

        # Try to send data to external endpoint
        success = service_definition.send()
        self.assertFalse(success)
        hook_log = hook.logs.all()[0]
        self.assertEqual(hook_log.status_code, KOBO_INTERNAL_ERROR_STATUS_CODE)
        self.assertEqual(hook_log.status, HOOK_LOG_PENDING)
        self.assertTrue('is not allowed' in hook_log.message)
