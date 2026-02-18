from unittest.mock import MagicMock, patch

import requests
from rest_framework import status

from kobo.apps.hook.constants import KOBO_INTERNAL_ERROR_STATUS_CODE
from kobo.apps.hook.models.hook_log import HookLog, HookLogStatus
from kobo.apps.hook.utils.services import call_services
from .base import BaseHookTestCase


class HookLogStatusTransitionsTestCase(BaseHookTestCase):
    """
    Test the status transitions when a submission is sent to an external REST service.

    This tests the RestService feature flow: the call_services() method triggers
    an asynchronous Celery task that posts the submission data to the configured
    endpoint, and the HookLog status is updated accordingly.
    """

    def setUp(self):
        super().setUp()
        self._setup_hook_and_submission()

    @patch('kobo.apps.hook.models.service_definition_interface.requests.post')
    def test_status_transition_pending_to_processing_to_success(self, mock_post):
        """
        Test the normal success flow: PENDING -> PROCESSING -> SUCCESS

        1. call_services() creates log with status=PENDING
        2. Task starts and updates to PROCESSING (status=PENDING & status_code=102)
        3. Request succeeds and updates to status=SUCCESS
        """

        # Mock successful response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = 'Submission received successfully'
        mock_post.return_value = mock_response

        # Step 1: call_services creates initial log
        with patch('kobo.apps.hook.utils.services.service_definition_task.delay'):
            success = call_services(self.asset.uid, self.submission_id)

        assert success is True

        log = HookLog.objects.get(hook=self.hook, submission_id=self.submission_id)
        assert log.status == HookLogStatus.PENDING
        assert log.status_code == KOBO_INTERNAL_ERROR_STATUS_CODE
        assert log.message == ''

        # Step 2 & 3: Task executes successfully
        ServiceDefinition = self.hook.get_service_definition()
        service = ServiceDefinition(self.hook, self.submission_id)
        result = service.send()

        assert result is True

        # Verify final state
        log.refresh_from_db()
        assert log.status == HookLogStatus.SUCCESS
        assert log.status_code == 200
        assert log.message == 'Submission received successfully'

    @patch('kobo.apps.hook.models.service_definition_interface.requests.post')
    def test_status_transition_pending_to_processing_to_failed(self, mock_post):
        """
        Test the failure flow: PENDING -> PROCESSING -> FAILED

        1. call_services() creates log with status=PENDING
        2. Task starts and updates to code=102
        3. Request fails with 400 and updates to status=FAILED
        """

        # Mock failed response (non-retriable error)
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = 'Bad request - invalid data'
        mock_response.raise_for_status.side_effect = (
            requests.exceptions.RequestException('HTTP 400')
        )
        mock_post.return_value = mock_response

        # Step 1: call_services creates initial log
        with patch('kobo.apps.hook.utils.services.service_definition_task.delay'):
            call_services(self.asset.uid, self.submission_id)

        log = HookLog.objects.get(hook=self.hook, submission_id=self.submission_id)
        assert log.status == HookLogStatus.PENDING
        assert log.status_code == KOBO_INTERNAL_ERROR_STATUS_CODE

        # Step 2 & 3: Task executes and fails
        ServiceDefinition = self.hook.get_service_definition()
        service = ServiceDefinition(self.hook, self.submission_id)

        try:
            service.send()
        except Exception:
            pass  # Expected to fail

        # Verify final state
        log.refresh_from_db()
        assert log.status == HookLogStatus.FAILED
        assert log.status_code == 400
        assert 'Bad request' in log.message

    @patch('kobo.apps.hook.models.service_definition_interface.requests.post')
    def test_oom_killed_before_processing_update(self, mock_post):
        """
        Simulate OOM kill BEFORE the task updates status to 102.

        1. call_services() creates log with status=PENDING, code=None
        2. Pod is killed before task starts (or very early in execution)
        3. Log remains at status=PENDING, code=None, message=''

        This represents the scenario caught by retry_stalled_pending_submissions()
        """

        # Step 1: call_services creates initial log
        with patch('kobo.apps.hook.utils.services.service_definition_task.delay'):
            call_services(self.asset.uid, self.submission_id)

        log = HookLog.objects.get(hook=self.hook, submission_id=self.submission_id)
        assert log.status == HookLogStatus.PENDING
        assert log.status_code == KOBO_INTERNAL_ERROR_STATUS_CODE
        assert log.message == ''

        # Step 2: Simulate OOM kill - task never starts
        # (we simply don't execute the task)

        # Verify log hasn't changed
        log.refresh_from_db()
        assert log.status == HookLogStatus.PENDING
        assert log.status_code == KOBO_INTERNAL_ERROR_STATUS_CODE
        assert log.message == ''
        assert log.tries == 0

    @patch('kobo.apps.hook.models.service_definition_interface.requests.post')
    def test_process_terminated(self, mock_post):
        """
        Simulate pod termination during HTTP request, but the finally block successfully
        updates the log to FAILED status.

        1. call_services() creates log with status=PENDING
        2. Task starts and updates to code=102
        3. requests.post is called and raises SystemExit (pod terminated by K8s)
        4. finally block successfully saves the error status
        5. Log is properly updated to status=FAILED

        This is the expected behavior when the finally block can execute before
        the pod is fully terminated (e.g., graceful shutdown, SIGTERM handling).
        """

        # Step 1: call_services creates initial log
        with patch('kobo.apps.hook.utils.services.service_definition_task.delay'):
            call_services(self.asset.uid, self.submission_id)

        # Step 2: Task starts and executes normally
        ServiceDefinition = self.hook.get_service_definition()
        service = ServiceDefinition(self.hook, self.submission_id)

        # Mock OOM kill during request
        def sigterm_signal(*args, **kwargs):
            raise SystemExit('Process terminated during HTTP request')

        mock_post.side_effect = sigterm_signal

        # Step 3: Execute task and catch SIGTERM
        try:
            service.send()
        except (Exception, SystemExit):
            pass  # Process terminated

        # Verify log is properly updated to FAILED (finally block succeeded)
        log = HookLog.objects.get(hook=self.hook, submission_id=self.submission_id)
        assert log.status == HookLogStatus.FAILED
        assert log.status_code == KOBO_INTERNAL_ERROR_STATUS_CODE
        assert 'Process terminated during HTTP request' in log.message

    @patch('kobo.apps.hook.models.service_definition_interface.requests.post')
    def test_oom_killed(self, mock_post):
        """
        Simulate OOM kill during or after the HTTP request, preventing the finally
        block from updating the log.

        1. call_services() creates log with status=PENDING
        2. Task starts and updates to code=102
        3. requests.post is called but pod is killed (during or after request)
        4. finally block tries to save but is prevented (simulated by mock)
        5. Log remains at status=PENDING, code=102

        This is the dangerous scenario - submission MAY have been sent but we can't
        record the response. Caught by mark_zombie_processing_submissions()
        """

        # Step 1: call_services creates initial log
        with patch('kobo.apps.hook.utils.services.service_definition_task.delay'):
            call_services(self.asset.uid, self.submission_id)

        # Step 2: Task starts and updates to 102
        ServiceDefinition = self.hook.get_service_definition()
        service = ServiceDefinition(self.hook, self.submission_id)

        # Mock save_log to allow the first call (update to 102)
        # but prevent subsequent calls (in finally block after OOM)
        original_save_log = service.save_log
        call_count = [0]

        def save_log_controlled(*args, **kwargs):
            call_count[0] += 1
            # First call: update to HTTP_102_PROCESSING (succeeds)
            if call_count[0] == 1:
                original_save_log(*args, **kwargs)
            # Second call would be in finally block after OOM - prevent it
            # This simulates the pod being killed before finally can complete
            else:
                pass  # Do nothing - simulate OOM preventing the save

        service.save_log = save_log_controlled

        # Mock OOM kill during request
        def oom_during_request(*args, **kwargs):
            raise SystemExit('OOM killed during HTTP request')

        mock_post.side_effect = oom_during_request

        # Step 3: Execute task and catch OOM kill
        try:
            service.send()
        except (Exception, SystemExit):
            pass  # OOM killed

        # Verify log is stuck at HTTP_102_PROCESSING(finally block couldn't save)
        log = HookLog.objects.get(hook=self.hook, submission_id=self.submission_id)
        assert log.status == HookLogStatus.PENDING
        assert log.status_code == status.HTTP_102_PROCESSING
        assert log.message == 'Submission is being queued for processing'
