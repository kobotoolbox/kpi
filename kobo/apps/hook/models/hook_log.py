from datetime import timedelta

import constance
from django.db import models
from django.utils import timezone

from kpi.fields import KpiUidField
from kpi.models.abstract_models import AbstractTimeStampedModel
from kpi.utils.log import logging
from ..constants import (
    HOOK_LOG_FAILED,
    HOOK_LOG_PENDING,
    KOBO_INTERNAL_ERROR_STATUS_CODE,
    HookLogStatus,
)


class HookLog(AbstractTimeStampedModel):

    hook = models.ForeignKey('Hook', related_name='logs', on_delete=models.CASCADE)
    uid = KpiUidField(uid_prefix='hl')
    submission_id = models.IntegerField(  # `KoboCAT.logger.Instance.id`
        default=0, db_index=True
    )
    tries = models.PositiveSmallIntegerField(default=0)
    status = models.PositiveSmallIntegerField(
        choices=[[e.value, e.name.title()] for e in HookLogStatus],
        default=HookLogStatus.PENDING.value,
    )  # Could use status_code, but will speed-up queries
    status_code = models.IntegerField(
        default=KOBO_INTERNAL_ERROR_STATUS_CODE, null=True, blank=True
    )
    message = models.TextField(default='')

    class Meta:
        ordering = ['-date_created']

    @property
    def can_retry(self) -> bool:
        """
        Return whether instance can be resent to external endpoint.
        Notice: even if False is returned, `self.retry()` can be triggered.
        """
        if self.hook.active:
            # If log is still pending after `constance.config.HOOK_MAX_RETRIES`
            # times, there was an issue, we allow the retry.
            threshold = timezone.now() - timedelta(seconds=120)

            return self.status == HOOK_LOG_FAILED or (
                self.date_modified < threshold
                and self.status == HOOK_LOG_PENDING
                and self.tries >= constance.config.HOOK_MAX_RETRIES
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
            logging.error('HookLog.retry - {}'.format(str(e)), exc_info=True)
            self.change_status(HOOK_LOG_FAILED)
            return False

        return True

    def save(self, *args, **kwargs):
        # We don't want to alter tries when we only change the status
        if kwargs.pop('reset_status', False) is False:
            self.tries += 1
            self.hook.reset_totals()
        super().save(*args, **kwargs)

    def __str__(self):
        return '<HookLog {uid}>'.format(uid=self.uid)
