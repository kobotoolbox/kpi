from __future__ import annotations

from django.conf import settings
from django.db import models

from kpi.fields import KpiUidField
from kpi.models.abstract_models import AbstractTimeStampedModel
from .choices import InviteStatusChoices


class Invite(AbstractTimeStampedModel):

    uid = KpiUidField(uid_prefix='poi')
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='transfer_ownership_requests',
        on_delete=models.CASCADE,
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='transfer_ownership_responses',
        on_delete=models.CASCADE,
    )
    status = models.CharField(
        max_length=11,
        choices=InviteStatusChoices.choices,
        default=InviteStatusChoices.PENDING,
        db_index=True
    )

    class Meta:
        verbose_name = 'project ownership transfer invite'

    def __str__(self):
        return (
            f'from {self.sender.username} to '
            f'{self.recipient.username} '
            f'({InviteStatusChoices(self.status)})'
        )
