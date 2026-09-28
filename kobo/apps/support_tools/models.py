from django.conf import settings
from django.core.cache import cache
from django.db import models

from kobo.apps.openrosa.apps.logger.utils.attachment_restore import (
    get_lock_cache_key,
)
from kpi.models.abstract_models import AbstractTimeStampedModel


class AttachmentRestoreJobStatus(models.TextChoices):
    PENDING = 'pending'
    IN_PROGRESS = 'in_progress'
    COMPLETED = 'completed'
    FAILED = 'failed'


class AttachmentRestoreJob(AbstractTimeStampedModel):
    """
    One launch of the attachment restore, and what it did.

    Support fills a row in to launch a run, and the run writes its log back
    here, so that what was asked, by whom, and what came of it are read in one
    place rather than pieced together afterwards.

    The row is a log, never a lock. A run killed outright, by an OOM or a pod
    eviction, never gets to close it, and only the Redis lock it holds expires
    on its own, so `is_running` asks that lock rather than this column.
    """

    asset_uid = models.CharField(max_length=32, verbose_name='project')
    dry_run = models.BooleanField(
        default=True,
        help_text=(
            'Report what would be restored, without writing anything. Turn this'
            ' off to actually restore the files.'
        ),
    )
    resume = models.BooleanField(
        default=True,
        help_text=(
            'Pick up where an interrupted run stopped, rather than walking the'
            ' project from its most recent attachment again.'
        ),
    )
    status = models.CharField(
        default=AttachmentRestoreJobStatus.PENDING,
        choices=AttachmentRestoreJobStatus,
        max_length=20,
    )
    scanned = models.PositiveIntegerField(default=0)
    restored = models.PositiveIntegerField(default=0)
    log = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name='+',
    )

    class Meta:
        verbose_name = 'Attachment restore'
        verbose_name_plural = 'Attachment restores'

    def __str__(self):
        mode = 'dry run' if self.dry_run else 'write'

        return f'{self.asset_uid} ({mode})'

    @property
    def is_running(self):
        """
        Report whether a run still holds the project.

        The lock is the only thing that answers this truthfully: it expires by
        itself, which no column does.
        """

        return cache.has_key(get_lock_cache_key(self.asset_uid))
