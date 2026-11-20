from __future__ import annotations

from datetime import datetime
from typing import Optional

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.utils.timezone import now

from hub.models import ExtraUserDetail
from kpi.fields import KpiUidField
from ..type_aliases import UpdatedQuerySetAndCount
from . import BaseTrash


class AccountTrash(BaseTrash):

    uid = KpiUidField(uid_prefix='at')
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, related_name='trash', on_delete=models.CASCADE
    )

    class Meta:
        verbose_name = 'user'
        verbose_name_plural = 'users'

    retention_setting = 'ACCOUNT_TRASH_RETENTION'

    def __str__(self) -> str:
        return f'{self.user.username} - {self.scheduled_time}'

    @property
    def scheduled_time(self) -> Optional[datetime]:
        """
        Return the time when the account becomes due for deletion.

        "Delete selected users" sends the deletion right away (see
        `move_to_trash()`), and it is the only action that does not retain a
        placeholder: those accounts are due as soon as they are trashed.
        """

        if not self.retain_placeholder and not self.empty_manually:
            return self.date_created

        return super().scheduled_time

    @classmethod
    def toggle_statuses(
        cls, object_identifiers: list[int], active: bool = False, **kwargs
    ) -> UpdatedQuerySetAndCount:
        """
        Toggle statuses of projects based on their primary key.
        """

        date_removal_requested = None if active else now()
        with transaction.atomic():
            queryset = get_user_model().objects.filter(pk__in=object_identifiers)
            updated = queryset.update(is_active=active)
            ExtraUserDetail.objects.filter(user_id__in=object_identifiers).update(
                date_removal_requested=date_removal_requested
            )
        return queryset, updated
