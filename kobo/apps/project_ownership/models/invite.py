from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone

from kpi.fields import KpiUidField


class InviteStatus(models.TextChoices):

    COMPLETE = 'complete', 'COMPLETE'
    DECLINED = 'declined', 'DECLINED'
    FAILED = 'failed', 'FAILED'
    IN_PROGRESS = 'in_progress', 'IN PROGRESS'
    PENDING = 'pending', 'PENDING'


class Invite(models.Model):

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
        choices=InviteStatus.choices,
        default=InviteStatus.PENDING,
        db_index=True
    )
    date_created = models.DateTimeField(default=timezone.now)
    date_modified = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = 'project ownership transfer invite'

    def __str__(self):
        return (
            f'from {self.source_user.username} to '
            f'{self.destination_user.username} '
            f'({InviteStatus(self.status).value})'
        )

    def save(self, *args, **kwargs):

        update_fields = kwargs.get('update_fields', [])

        if not update_fields or 'date_modified' in update_fields:
            self.date_modified = timezone.now()

        super().save(*args, **kwargs)
