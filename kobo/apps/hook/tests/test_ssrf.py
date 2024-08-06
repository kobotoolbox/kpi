
import pytest
import responses
from constance.test import override_config
from mock import patch
from rest_framework import status
from ssrf_protect.exceptions import SSRFProtectException

from kobo.apps.hook.constants import (
    HOOK_LOG_FAILED,
    KOBO_INTERNAL_ERROR_STATUS_CODE
)
from .hook_test_case import HookTestCase, MockSSRFProtect


class SSRFHookTestCase(HookTestCase):

    @patch('ssrf_protect.ssrf_protect.SSRFProtect._get_ip_address',
           new=MockSSRFProtect._get_ip_address)
    @override_config(SSRF_DENIED_IP_ADDRESS='1.2.3.4')
    @responses.activate
    def test_send_with_ssrf_options(self):
        # Create first hook

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
        with pytest.raises(SSRFProtectException):
            service_definition.send()

        hook_log = hook.logs.all()[0]
        self.assertEqual(hook_log.status_code, KOBO_INTERNAL_ERROR_STATUS_CODE)
        self.assertEqual(hook_log.status, HOOK_LOG_FAILED)
        self.assertTrue('is not allowed' in hook_log.message)
