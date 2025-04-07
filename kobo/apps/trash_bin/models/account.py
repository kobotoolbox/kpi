from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.utils.timezone import now

from hub.models import ExtraUserDetail
from kpi.fields import KpiUidField
from . import BaseTrash


class AccountTrash(BaseTrash):

    uid = KpiUidField(uid_prefix='at')
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, related_name='trash', on_delete=models.CASCADE
    )

    class Meta:
        verbose_name = 'user'
        verbose_name_plural = 'users'

    def __str__(self) -> str:
        try:
            return f'{self.user.username} - {self.periodic_task.clocked.clocked_time}'
        except AttributeError:
            return f'{self.user.username} - None'

    @classmethod
    def toggle_statuses(cls, object_identifiers: list[int], active: bool = False):
        """
        Toggle statuses of projects based on their primary key.
        """

        date_removal_requested = None if active else now()
        with transaction.atomic():
            get_user_model().objects.filter(pk__in=object_identifiers).update(
                is_active=active
            )
            ExtraUserDetail.objects.filter(user_id__in=object_identifiers).update(
                date_removal_requested=date_removal_requested
            )
