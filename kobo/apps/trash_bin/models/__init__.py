from datetime import datetime, timedelta
from typing import Optional

from constance import config
from django.conf import settings
from django.db import models

from kpi.models.abstract_models import AbstractTimeStampedModel
from ..type_aliases import ObjectIdentifiers, UpdatedQuerySetAndCount


class TrashStatus(models.TextChoices):

    IN_PROGRESS = 'in_progress', 'IN PROGRESS'
    PENDING = 'pending', 'PENDING'
    RETRY = 'retry', 'RETRY'
    FAILED = 'failed', 'FAILED'


class BaseTrash(AbstractTimeStampedModel):

    class Meta:
        abstract = True

    status = models.CharField(
        max_length=11, choices=TrashStatus, default=TrashStatus.PENDING, db_index=True
    )
    periodic_task = models.OneToOneField(
        'django_celery_beat.PeriodicTask', null=True, on_delete=models.RESTRICT
    )
    request_author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    metadata = models.JSONField(default=dict)
    # The object is never deleted automatically: only a superuser can empty it
    # from the admin interface. See `scheduled_time`.
    empty_manually = models.BooleanField(default=False)
    # Help to determine deletion logic in Celery tasks, i.e.: remove vs delete
    # users' accounts.
    # Projects are always deleted entirely, and related Celery tasks ignore this
    # field, but it could be implemented at a later time.
    retain_placeholder = models.BooleanField(default=True)

    # Name of the Constance setting that holds the retention, in days, of this
    # type of object
    retention_setting: str

    @property
    def scheduled_time(self) -> Optional[datetime]:
        """
        Return the time when the object becomes due for deletion, or `None`
        when it must be emptied manually.

        The retention is read from Constance on every call, so that a new value
        applies to every object still in trash. A retention of -1 means that
        objects are never deleted automatically.
        """

        if self.empty_manually:
            return None

        retention = getattr(config, self.retention_setting)
        if retention < 0:
            return None

        return self.date_created + timedelta(days=retention)

    @classmethod
    def toggle_statuses(
        cls,
        object_identifiers: ObjectIdentifiers,
        active: bool = True,
        **kwargs
    ) -> Optional[UpdatedQuerySetAndCount]:
        raise NotImplementedError
