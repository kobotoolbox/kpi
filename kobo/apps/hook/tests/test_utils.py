from ipaddress import ip_address
from unittest.mock import MagicMock, patch

import responses
from rest_framework import status

from ..utils.services import call_services
from .hook_test_case import HookTestCase


class HookUtilsTestCase(HookTestCase):

    @patch(
        'ssrf_protect.ssrf_protect.SSRFProtect._get_ip_address',
        new=MagicMock(return_value=ip_address('1.2.3.4')),
    )
    @responses.activate
    def test_data_submission(self):
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
        # Since second hook hasn't received the submission, `call_services`
        # should still return True
        assert call_services(self.asset.uid, submission_id) is True

        # But if we try again, it should return False (we cannot send the same
        # submission twice to the same external endpoint).
        assert call_services(self.asset.uid, submission_id) is False
