from datetime import timedelta

import constance
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
    SUCCESS = 2, 'success'


class HookLog(AbstractTimeStampedModel):

    hook = models.ForeignKey('Hook', related_name='logs', on_delete=models.CASCADE)
    uid = KpiUidField(uid_prefix='hl')
    submission_id = models.IntegerField(  # `KoboCAT.logger.Instance.id`
        default=0, db_index=True
    )
    tries = models.PositiveSmallIntegerField(default=0)
    status = models.PositiveSmallIntegerField(
        choices=HookLogStatus.choices,
        default=HookLogStatus.PENDING,
    )  # Could use status_code, but will speed-up queries
    status_code = models.IntegerField(
        default=KOBO_INTERNAL_ERROR_STATUS_CODE, null=True, blank=True
    )
    message = models.TextField(default='')

    class Meta:
        ordering = ['-date_created']
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
        if self.hook.active:
            # If log is still pending after `constance.config.HOOK_MAX_RETRIES`
            # times, there was an issue, we allow the retry.
            threshold = timezone.now() - timedelta(seconds=120)

            return self.status == HookLogStatus.FAILED or (
                self.date_modified < threshold
                and self.status == HookLogStatus.PENDING
                and self.tries >= constance.config.HOOK_MAX_RETRIES
            )

        return False

    def retry(self):
        """
        Retries to send data to external service
        :return: boolean
        """

        ServiceDefinition = self.hook.get_service_definition()
        service_definition = ServiceDefinition(self.hook, self.submission_id)

        try:
            result = service_definition.send()
            self.refresh_from_db()
            return result
        except Exception as e:
            logging.error('HookLog.retry failed', exc_info=True)
            self.refresh_from_db()
            return False

    def save(self, *args, **kwargs):
        self.hook.reset_totals()
        super().save(*args, **kwargs)

    def __str__(self):
        return '<HookLog {uid}>'.format(uid=self.uid)
