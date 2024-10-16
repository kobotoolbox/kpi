from django.conf import settings
from django.db import models

from kpi.models.abstract_models import AbstractTimeStampedModel


class TrashStatus(models.TextChoices):

    IN_PROGRESS = 'in_progress', 'IN PROGRESS'
    PENDING = 'pending', 'PENDING'
    RETRY = 'retry', 'RETRY'
    FAILED = 'failed', 'FAILED'


class BaseTrash(AbstractTimeStampedModel):

    class Meta:
        abstract = True

    status = models.CharField(
        max_length=11,
        choices=TrashStatus.choices,
        default=TrashStatus.PENDING,
        db_index=True
    )
    periodic_task = models.OneToOneField(
        'django_celery_beat.PeriodicTask', null=True, on_delete=models.RESTRICT
    )
    request_author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    metadata = models.JSONField(default=dict)
    # Celery will run a task at a specific moment - according to the Constance
    # setting `ACCOUNT_TRASH_GRACE_PERIOD` - to delete (or remove) the object.
    # Because this setting can be changed at any time, its value can be
    # different when celery task runs than the object creation. Therefore,
    # this field helps to know whether a periodic task will run automatically or
    # not. Useful in the admin interface to display in the trash bin object lists.
    # Projects are always automatically deleted and related Celery task ignore
    # this field, but it could be implemented at a later time.
    empty_manually = models.BooleanField(default=False)
    # Help to determine deletion logic in Celery task, i.e.: remove vs delete
    # users' accounts.
    # Projects are always deleted entirely and related Celery task ignore this
    # field, but it could be implemented at a later time.
    retain_placeholder = models.BooleanField(default=True)
