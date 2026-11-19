from datetime import datetime, timedelta

import constance
from django.conf import settings
from django.db import models
from django.db.models.constraints import UniqueConstraint
from django.utils import timezone

from kpi.fields import KpiUidField
from kpi.models.abstract_models import AbstractTimeStampedModel
from kpi.utils.log import logging
from ..constants import KOBO_INTERNAL_ERROR_STATUS_CODE


class HookLogStatus(models.IntegerChoices):
    FAILED = 0, 'failed'
    PENDING = 1, 'pending'
    PROCESSING = 3, 'processing'
    SUCCESS = 2, 'success'


class HookLog(AbstractTimeStampedModel):

    hook = models.ForeignKey('Hook', related_name='logs', on_delete=models.CASCADE)
    uid = KpiUidField(uid_prefix='hl')
    submission_id = models.IntegerField(  # `KoboCAT.logger.Instance.id`
        default=0, db_index=True
    )
    tries = models.PositiveSmallIntegerField(default=0)
    status = models.PositiveSmallIntegerField(
        choices=HookLogStatus,
        default=HookLogStatus.PENDING,
    )  # Could use status_code, but will speed-up queries
    status_code = models.IntegerField(
        default=KOBO_INTERNAL_ERROR_STATUS_CODE, null=True, blank=True
    )
    message = models.TextField(default='')

    class Meta:
        ordering = ['-date_created']
        indexes = [
            models.Index(fields=('hook', 'submission_id')),
        ]
        constraints = [
            UniqueConstraint(
                fields=['hook', 'submission_id'],
                name='uniq_hook_submission',
            ),
        ]

    @property
    def can_retry(self) -> bool:
        """
        Return whether instance can be resent to external endpoint.
        Notice: even if False is returned, `self.retry()` can be triggered.
        """
        if not self.hook.active:
            return False

        if self.status == HookLogStatus.FAILED:
            return True

        # A pending log that used all its automatic retries and is still
        # pending after its last attempt was due is stalled, we allow the retry.
        return (
            self.status == HookLogStatus.PENDING
            and self.tries >= constance.config.HOOK_MAX_RETRIES
            and self.date_modified < self.get_stalled_retry_threshold()
        )

    @staticmethod
    def get_stalled_retry_threshold() -> datetime:
        """
        Return the date before which a pending log that used all its automatic
        retries is considered stalled.

        Its last attempt runs at most `HOOK_RETRY_BACKOFF_MAX` seconds after the
        previous one. The threshold doubles that delay to give a busy worker
        time to start it.
        """

        return timezone.now() - timedelta(seconds=2 * settings.HOOK_RETRY_BACKOFF_MAX)

    def retry(self):
        """
        Retries to send data to external service in a single attempt.

        A retriable error marks the log as failed instead of scheduling
        automatic retries.

        :return: boolean
        """

        ServiceDefinition = self.hook.get_service_definition()
        service_definition = ServiceDefinition(self.hook, self.submission_id)

        try:
            result = service_definition.send(allow_retry=False)
            self.refresh_from_db()
            return result
        except Exception:
            logging.error('HookLog.retry failed', exc_info=True)
            self.refresh_from_db()
            return False

    def save(self, *args, **kwargs):
        self.hook.reset_totals()
        super().save(*args, **kwargs)

    def __str__(self):
        return '<HookLog {uid}>'.format(uid=self.uid)
