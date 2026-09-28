from ipaddress import ip_address
from unittest.mock import MagicMock, patch
from urllib.parse import urlparse

import pytest
import responses
from constance.test import override_config
from rest_framework import status
from ssrf_protect.exceptions import SSRFProtectException

from kobo.apps.hook.constants import KOBO_INTERNAL_ERROR_STATUS_CODE
from kobo.apps.hook.models.hook_log import HookLogStatus
from .base import BaseHookTestCase


def _resolve(url):
    """
    Resolve any hostname to a public IP and leave literal IPs untouched.

    Lets the hook endpoint pass validation while the redirect target
    (`127.0.0.1`) resolves to itself and is denied as loopback.
    """
    host = urlparse(url).hostname
    try:
        return ip_address(host)
    except ValueError:
        return ip_address('1.2.3.4')


class SSRFHookTestCase(BaseHookTestCase):

    @patch(
        'ssrf_protect.ssrf_protect.SSRFProtect._get_ip_address',
        new=MagicMock(return_value=ip_address('1.2.3.4')),
    )
    @override_config(SSRF_DENIED_IP_ADDRESS='1.2.3.4')
    @responses.activate
    def test_send_with_ssrf_options(self):

        # Create first hook
        hook = self._create_hook()

        ServiceDefinition = hook.get_service_definition()
        submissions = self.asset.deployment.get_submissions(self.asset.owner)
        submission_id = submissions[0]['_id']
        service_definition = ServiceDefinition(hook, submission_id)
        responses.add(
            responses.POST,
            hook.endpoint,
            status=status.HTTP_200_OK,
            content_type='application/json',
        )

        # Try to send data to external endpoint
        # Note: it should failed because we explicitly deny 1.2.3.4 and
        # SSRFProtect._get_ip_address is mocked to return 1.2.3.4
        with pytest.raises(SSRFProtectException):
            service_definition.send()

        hook_log = hook.logs.all()[0]
        self.assertEqual(hook_log.status_code, KOBO_INTERNAL_ERROR_STATUS_CODE)
        self.assertEqual(hook_log.status, int(HookLogStatus.FAILED))
        self.assertTrue('is not allowed' in hook_log.message)

    @patch(
        'ssrf_protect.ssrf_protect.SSRFProtect._get_ip_address',
        new=MagicMock(side_effect=_resolve),
    )
    @responses.activate
    def test_send_blocks_redirect_to_private_ip(self):

        hook = self._create_hook()

        ServiceDefinition = hook.get_service_definition()
        submissions = self.asset.deployment.get_submissions(self.asset.owner)
        submission_id = submissions[0]['_id']
        service_definition = ServiceDefinition(hook, submission_id)
        responses.add(
            responses.POST,
            hook.endpoint,
            status=status.HTTP_307_TEMPORARY_REDIRECT,
            headers={'Location': 'http://127.0.0.1/internal'},
        )

        # The endpoint resolves public and is fetched, but the redirect to a
        # loopback address must be blocked before it is ever requested.
        with pytest.raises(SSRFProtectException):
            service_definition.send()

        hook_log = hook.logs.all()[0]
        self.assertEqual(hook_log.status_code, KOBO_INTERNAL_ERROR_STATUS_CODE)
        self.assertEqual(hook_log.status, int(HookLogStatus.FAILED))
        self.assertTrue('is not allowed' in hook_log.message)
        self.assertEqual([c.request.url for c in responses.calls], [hook.endpoint])
