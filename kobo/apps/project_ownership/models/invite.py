from __future__ import annotations

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone

from kpi.fields import KpiUidField
from .base import TimeStampedModel
from .choices import InviteStatusChoices, TransferStatusChoices


class Invite(TimeStampedModel):

    uid = KpiUidField(uid_prefix='poi')
    source_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='transfer_ownership_requests',
        on_delete=models.CASCADE,
    )
    destination_user = models.ForeignKey(
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
            f'from {self.source_user.username} to '
            f'{self.destination_user.username} '
            f'({InviteStatusChoices(self.status).value})'
        )

    def update_status_from_transfers(self):
        with transaction.atomic():
            invite = self.__class__.objects.select_for_update().get(
                pk=self.pk
            )
            previous_status = invite.status
            is_complete = True

            for transfer in self.transfers.all():
                if transfer.status == TransferStatusChoices.FAILED.value:
                    invite.status = InviteStatusChoices.FAILED.value
                    is_complete = False
                    break
                elif transfer.status != TransferStatusChoices.SUCCESS.value:
                    is_complete = False

            if is_complete:
                invite.status = InviteStatusChoices.COMPLETE.value

            if previous_status != invite.status:
                invite.date_modified = timezone.now()
                invite.save(update_fields=['status', 'date_modified'])

        if previous_status != invite.status:
            self.refresh_from_db()
