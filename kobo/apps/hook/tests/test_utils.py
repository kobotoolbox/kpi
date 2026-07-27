from ipaddress import ip_address
from unittest.mock import MagicMock, patch

import pytest
import responses
from rest_framework import status

from ..utils.services import call_services
from .base import BaseHookTestCase


class HookUtilsTestCase(BaseHookTestCase):

    @pytest.mark.allow_openapi_mismatch('response-validation', 'api/v2/assets/', 'POST')
    @pytest.mark.allow_openapi_mismatch(
        'request-payload-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/hooks/',
        'POST',
    )
    @pytest.mark.allow_openapi_mismatch(
        'response-validation',
        'api/v2/assets/(?P<uid_asset>[^/.]+)/hooks/',
        'POST',
    )
    @patch(
        'ssrf_protect.ssrf_protect.SSRFProtect._get_ip_address',
        new=MagicMock(return_value=ip_address('1.2.3.4')),
    )
    @responses.activate
    def test_data_submission_with_multiple_hooks(self):
        """
        Test that call_services() correctly handles multiple hooks:
        - First call with 1 hook returns True
        - Second call with 2 hooks returns True (only for the new hook)
        - Third call returns False (all hooks already notified)
        """
        # Create first hook
        first_hook = self._create_hook(
            name='dummy external service',
            endpoint='http://dummy.service.local/',
            settings={},
        )
        responses.add(
            responses.POST,
            first_hook.endpoint,
            status=status.HTTP_200_OK,
            content_type='application/json',
        )

        submissions = self.asset.deployment.get_submissions(self.asset.owner)
        submission_id = submissions[0]['_id']

        # First hook receives the submission
        assert call_services(self.asset.uid, submission_id) is True

        # Create second hook
        second_hook = self._create_hook(
            name='other dummy external service',
            endpoint='http://otherdummy.service.local/',
            settings={},
        )
        responses.add(
            responses.POST,
            second_hook.endpoint,
            status=status.HTTP_200_OK,
            content_type='application/json',
        )

        # Second hook should receive the submission (returns True)
        assert call_services(self.asset.uid, submission_id) is True

        # Both hooks have already received it, should return False
        assert call_services(self.asset.uid, submission_id) is False
