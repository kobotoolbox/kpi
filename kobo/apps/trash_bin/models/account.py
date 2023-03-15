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
        return f'{self.user.username} - {self.periodic_task.start_time}'

    @classmethod
    def toggle_user_statuses(cls, users: list[dict], active: bool = False):

        date_removal_request = None if active else now()
        with transaction.atomic():
            user_ids = [u['pk'] for u in users]
            get_user_model().objects.filter(pk__in=user_ids).update(
                is_active=active
            )
            ExtraUserDetail.objects.filter(user_id__in=user_ids).update(
                date_removal_request=date_removal_request
            )
