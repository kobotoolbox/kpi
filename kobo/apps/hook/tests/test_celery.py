from datetime import timedelta
from unittest.mock import patch

from django.conf import settings
from django.utils import timezone
from rest_framework import status

from kobo.apps.hook.constants import KOBO_INTERNAL_ERROR_STATUS_CODE
from kobo.apps.hook.models.hook import Hook
from kobo.apps.hook.models.hook_log import HookLog, HookLogStatus
from kobo.apps.hook.tasks import (
    mark_zombie_processing_submissions,
    retry_stalled_pending_submissions,
)
from kobo.apps.hook.tests.base import BaseHookTestCase


class HookRetryStalledSubmissionTestCase(BaseHookTestCase):
    """
    Tests for retry_stalled_pending_submissions task
    """

    def setUp(self):
        super().setUp()
        self._setup_hook_and_submission()

    def test_retries_stalled_submissions_older_than_2_hours(self):
        """
        Should re-queue submissions that are stalled (PENDING, 500, empty message)
        and older than 2 hours
        """
        old_time = timezone.now() - timedelta(hours=3)

        # Create stalled log (should be retried)
        stalled_log = HookLog.objects.create(
            hook=self.hook,
            submission_id=123,
            status=HookLogStatus.PENDING,
            status_code=KOBO_INTERNAL_ERROR_STATUS_CODE,
            message='',
        )
        # Manually set the modified date to simulate old entry
        HookLog.objects.filter(pk=stalled_log.pk).update(date_modified=old_time)

        with patch('kobo.apps.hook.tasks.service_definition_task.delay') as mock_delay:
            retry_stalled_pending_submissions()

            mock_delay.assert_called_once_with(self.hook.id, 123)

    def test_ignores_recent_stalled_submissions(self):
        """
        Should NOT retry submissions that are less than 2 hours old
        """
        recent_time = timezone.now() - timedelta(minutes=30)

        # Create recent stalled log (should NOT be retried)
        recent_log = HookLog.objects.create(
            hook=self.hook,
            submission_id=456,
            status=HookLogStatus.PENDING,
            status_code=KOBO_INTERNAL_ERROR_STATUS_CODE,
            message='',
        )
        HookLog.objects.filter(pk=recent_log.pk).update(date_modified=recent_time)

        with patch('kobo.apps.hook.tasks.service_definition_task.delay') as mock_delay:
            retry_stalled_pending_submissions()

            mock_delay.assert_not_called()

    def test_ignores_logs_with_different_status_code(self):
        """
        Should NOT retry submissions with status codes other than 500
        """
        old_time = timezone.now() - timedelta(hours=3)

        # Create log with 404 status code (should NOT be retried)
        log = HookLog.objects.create(
            hook=self.hook,
            submission_id=789,
            status=HookLogStatus.PENDING,
            status_code=404,
            message='',
        )
        HookLog.objects.filter(pk=log.pk).update(date_modified=old_time)

        with patch('kobo.apps.hook.tasks.service_definition_task.delay') as mock_delay:
            retry_stalled_pending_submissions()

            mock_delay.assert_not_called()

    def test_ignores_logs_with_message(self):
        """
        Should NOT retry submissions that have an error message
        """
        old_time = timezone.now() - timedelta(hours=3)

        # Create log with message (should NOT be retried)
        log = HookLog.objects.create(
            hook=self.hook,
            submission_id=101,
            status=HookLogStatus.PENDING,
            status_code=KOBO_INTERNAL_ERROR_STATUS_CODE,
            message='Some error occurred',
        )
        HookLog.objects.filter(pk=log.pk).update(date_modified=old_time)

        with patch('kobo.apps.hook.tasks.service_definition_task.delay') as mock_delay:
            retry_stalled_pending_submissions()

            mock_delay.assert_not_called()

    def test_ignores_failed_status(self):
        """
        Should NOT retry submissions that are already marked as FAILED
        """
        old_time = timezone.now() - timedelta(hours=3)

        # Create failed log (should NOT be retried)
        log = HookLog.objects.create(
            hook=self.hook,
            submission_id=102,
            status=HookLogStatus.FAILED,
        )
        HookLog.objects.filter(pk=log.pk).update(date_modified=old_time)

        with patch('kobo.apps.hook.tasks.service_definition_task.delay') as mock_delay:
            retry_stalled_pending_submissions()

            mock_delay.assert_not_called()

    def test_retries_multiple_stalled_submissions(self):
        """
        Should retry all stalled submissions
        """
        old_time = timezone.now() - timedelta(hours=3)

        # Create multiple stalled logs
        for submission_id in [200, 201, 202]:
            log = HookLog.objects.create(
                hook=self.hook,
                submission_id=submission_id,
                status=HookLogStatus.PENDING,
                status_code=KOBO_INTERNAL_ERROR_STATUS_CODE,
                message='',
            )
            HookLog.objects.filter(pk=log.pk).update(date_modified=old_time)

        with patch('kobo.apps.hook.tasks.service_definition_task.delay') as mock_delay:
            retry_stalled_pending_submissions()

            assert mock_delay.call_count == 3

    def test_do_retry_if_hook_is_deactived(self):
        """
        Should not retry stalled submissions from deactivated hook
        """

        old_time = timezone.now() - timedelta(hours=3)

        # Create multiple stalled logs
        for submission_id in [200, 201, 202]:
            log = HookLog.objects.create(
                hook=self.hook,
                submission_id=submission_id,
                status=HookLogStatus.PENDING,
                status_code=KOBO_INTERNAL_ERROR_STATUS_CODE,
                message='',
            )
            HookLog.objects.filter(pk=log.pk).update(date_modified=old_time)

        Hook.objects.filter(pk=self.hook.pk).update(active=False)

        with patch('kobo.apps.hook.tasks.service_definition_task.delay') as mock_delay:
            retry_stalled_pending_submissions()

            mock_delay.assert_not_called()


class HookMarkZombieSubmissionTestCase(BaseHookTestCase):
    """
    Tests for mark_zombie_processing_submissions task
    """

    def setUp(self):
        super().setUp()
        self._setup_hook_and_submission()

    def test_marks_zombie_processing_submissions_as_failed(self):
        """
        Should mark as FAILED submissions stuck in PROCESSING state for > 2 hours
        """
        old_time = timezone.now() - timedelta(hours=3)

        # Create zombie log (should be marked as failed)
        zombie_log = HookLog.objects.create(
            hook=self.hook,
            submission_id=123,
            status=HookLogStatus.PROCESSING,
            message='Submission is being queued for processing',
        )
        HookLog.objects.filter(pk=zombie_log.pk).update(date_modified=old_time)

        mark_zombie_processing_submissions()

        zombie_log.refresh_from_db()
        assert zombie_log.status == HookLogStatus.FAILED
        assert zombie_log.status_code == KOBO_INTERNAL_ERROR_STATUS_CODE
        assert 'interrupted' in zombie_log.message.lower()
        assert 'MAY have been sent' in zombie_log.message

    def test_ignores_recent_processing_submissions(self):
        """
        Should NOT mark submissions that are less than 2 hours old
        """
        recent_time = timezone.now() - timedelta(minutes=30)

        # Create recent processing log (should NOT be marked as failed)
        recent_log = HookLog.objects.create(
            hook=self.hook,
            submission_id=456,
            status=HookLogStatus.PROCESSING,
            message='Submission is being queued for processing',
        )
        HookLog.objects.filter(pk=recent_log.pk).update(date_modified=recent_time)

        mark_zombie_processing_submissions()

        recent_log.refresh_from_db()
        assert recent_log.status == HookLogStatus.PROCESSING

    def test_ignores_logs_with_different_status_code(self):
        """
        Should NOT mark submissions with status other than PROCESSING
        """
        old_time = timezone.now() - timedelta(
            minutes=settings.HOOK_STALLED_PENDING_TIMEOUT + 10
        )

        # Create log with 200 status code (should NOT be marked)
        log = HookLog.objects.create(
            hook=self.hook,
            submission_id=789,
            status=HookLogStatus.PENDING,
            status_code=status.HTTP_200_OK,
            message='',
        )
        HookLog.objects.filter(pk=log.pk).update(date_modified=old_time)

        mark_zombie_processing_submissions()

        log.refresh_from_db()
        assert log.status == HookLogStatus.PENDING
        assert log.status_code == status.HTTP_200_OK

    def test_ignores_already_failed_logs(self):
        """
        Should NOT process logs that are already FAILED
        """
        old_time = timezone.now() - timedelta(
            minutes=settings.HOOK_STALLED_PENDING_TIMEOUT + 10
        )

        # Create failed log (should NOT be processed)
        log = HookLog.objects.create(
            hook=self.hook,
            submission_id=101,
            status=HookLogStatus.FAILED,
            status_code=status.HTTP_400_BAD_REQUEST,
            message='Already failed',
        )
        HookLog.objects.filter(pk=log.pk).update(date_modified=old_time)

        original_message = log.message
        mark_zombie_processing_submissions()

        log.refresh_from_db()
        assert log.status == HookLogStatus.FAILED
        assert log.message == original_message

    def test_ignores_success_logs(self):
        """
        Should NOT process logs that are already SUCCESS
        """
        old_time = timezone.now() - timedelta(
            minutes=settings.HOOK_STALLED_PENDING_TIMEOUT + 10
        )

        # Create success log (should NOT be processed)
        log = HookLog.objects.create(
            hook=self.hook,
            submission_id=102,
            status=HookLogStatus.SUCCESS,
            status_code=status.HTTP_200_OK,
            message='Success',
        )
        HookLog.objects.filter(pk=log.pk).update(date_modified=old_time)

        mark_zombie_processing_submissions()

        log.refresh_from_db()
        assert log.status == HookLogStatus.SUCCESS

    def test_marks_multiple_zombie_submissions(self):
        """
        Should mark all zombie submissions as failed
        """
        old_time = timezone.now() - timedelta(
            minutes=settings.HOOK_STALLED_PENDING_TIMEOUT + 10
        )

        # Create multiple zombie logs
        for submission_id in [200, 201, 202]:
            log = HookLog.objects.create(
                hook=self.hook,
                submission_id=submission_id,
                status=HookLogStatus.PROCESSING,
                message='Submission is being queued for processing',
            )
            HookLog.objects.filter(pk=log.pk).update(date_modified=old_time)

        mark_zombie_processing_submissions()

        # Verify all are marked as failed
        failed_count = HookLog.objects.filter(
            hook=self.hook,
            submission_id__in=[200, 201, 202],
            status=HookLogStatus.FAILED,
        ).count()

        assert failed_count == 3

    def test_marks_multiple_zombie_submissions_even_if_hook_is_deactivated(self):
        Hook.objects.filter(pk=self.hook.pk).update(active=False)
        self.test_marks_multiple_zombie_submissions()

    def test_message_explains_uncertainty(self):
        """
        The failure message should clearly explain the uncertainty about
        whether the submission was sent
        """
        old_time = timezone.now() - timedelta(
            minutes=settings.HOOK_STALLED_PENDING_TIMEOUT + 10
        )

        zombie_log = HookLog.objects.create(
            hook=self.hook,
            submission_id=999,
            status=HookLogStatus.PROCESSING,
            message='Submission is being queued for processing',
        )
        HookLog.objects.filter(pk=zombie_log.pk).update(date_modified=old_time)

        mark_zombie_processing_submissions()

        zombie_log.refresh_from_db()
        message = zombie_log.message

        # Verify key points are in the message
        assert 'interrupted' in message.lower()
        assert 'MAY have been sent' in message
        assert 'verify manually' in message.lower()
        assert 'remote server' in message.lower()
        assert 'avoid duplicate' in message.lower()
