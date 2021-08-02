# coding: utf-8
import constance
from datetime import timedelta
from django.db import models
from django.utils import timezone

from kpi.fields import KpiUidField
from kpi.utils.log import logging
from ..constants import HOOK_LOG_PENDING, HOOK_LOG_FAILED, HOOK_LOG_SUCCESS, KOBO_INTERNAL_ERROR_STATUS_CODE


class HookLog(models.Model):

    hook = models.ForeignKey("Hook", related_name="logs", on_delete=models.CASCADE)
    uid = KpiUidField(uid_prefix="hl")
    submission_id = models.IntegerField(default=0, db_index=True)  # `KoBoCAT.logger.Instance.id`
    tries = models.PositiveSmallIntegerField(default=0)
    status = models.PositiveSmallIntegerField(default=HOOK_LOG_PENDING)  # Could use status_code, but will speed-up queries
    status_code = models.IntegerField(default=KOBO_INTERNAL_ERROR_STATUS_CODE, null=True, blank=True)
    message = models.TextField(default="")
    date_created = models.DateTimeField(auto_now_add=True)
    date_modified = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_created"]

    def can_retry(self) -> bool:
        """
        Return whether instance can be resent to external endpoint.
        Notice: even if False is returned, `self.retry()` can be triggered.
        """
        if self.hook.active:
            seconds = HookLog.get_elapsed_seconds(
                constance.config.HOOK_MAX_RETRIES
            )
            threshold = timezone.now() - timedelta(seconds=seconds)
            # We can retry only if system has already tried 3 times.
            # If log is still pending after 3 times, there was an issue,
            # we allow the retry
            return (
                self.status == HOOK_LOG_FAILED
                or (self.date_modified < threshold and self.status == HOOK_LOG_PENDING)
            )

        return False

    def change_status(
        self, status=HOOK_LOG_PENDING, message=None, status_code=None
    ):
        self.status = status

        if message:
            self.message = message

        if status_code:
            self.status_code = status_code

        self.save(reset_status=True)

    @staticmethod
    def get_elapsed_seconds(retries_count: int) -> int:
        """
        Calculate number of elapsed seconds since first try.
        Return the number of seconds.
        """
        # We need to sum all seconds between each retry
        seconds = 0
        for retries_count in range(retries_count):
            # Range is zero-indexed
            seconds += HookLog.get_remaining_seconds(retries_count)

        return seconds

    @staticmethod
    def get_remaining_seconds(retries_count):
        """
        Calculate number of remaining seconds before next retry
        :param retries_count: int.
        :return: int. Number of seconds
        """
        return 60 * (10 ** retries_count)

    def retry(self):
        """
        Retries to send data to external service
        :return: boolean
        """
        try:
            ServiceDefinition = self.hook.get_service_definition()
            service_definition = ServiceDefinition(self.hook, self.submission_id)
            service_definition.send()
            self.refresh_from_db()
        except Exception as e:
            logging.error("HookLog.retry - {}".format(str(e)), exc_info=True)
            self.change_status(HOOK_LOG_FAILED)
            return False

        return True

    def save(self, *args, **kwargs):
        # Update date_modified each time object is saved
        self.date_modified = timezone.now()
        # We don't want to alter tries when we only change the status
        if kwargs.pop("reset_status", False) is False:
            self.tries += 1
            self.hook.reset_totals()
        super().save(*args, **kwargs)

    @property
    def status_str(self):
        if self.status == HOOK_LOG_PENDING:
            return "Pending"
        elif self.status == HOOK_LOG_FAILED:
            return "Failed"
        elif self.status == HOOK_LOG_SUCCESS:
            return "Success"

    def __str__(self):
        return "<HookLog {uid}>".format(uid=self.uid)
