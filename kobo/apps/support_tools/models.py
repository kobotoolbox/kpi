from django.conf import settings
from django.core.cache import cache
from django.db import models

from kobo.apps.support_tools.utils.restorers.attachment import AttachmentRestorer
from kobo.apps.support_tools.utils.restorers.form_versions import (
    FormVersionsRestorer,
)
from kpi.models.abstract_models import AbstractTimeStampedModel


class RestoreJobStatus(models.TextChoices):
    PENDING = 'pending'
    IN_PROGRESS = 'in_progress'
    COMPLETED = 'completed'
    FAILED = 'failed'


class AbstractRestoreJob(AbstractTimeStampedModel):
    """
    One launch of a restore on a project, and what it did.

    Support fills a row in to launch a run, and the run writes its log back
    here, so that what was asked, by whom, and what came of it are read in one
    place rather than pieced together afterwards.

    The row is a log, never a lock. A run killed outright, by an OOM or a pod
    eviction, never gets to close it, and only the Redis lock it holds expires
    on its own, so `is_running` asks that lock rather than this column.

    Subclasses name the `ProjectRestorer` they launch with `restorer_class`, and
    the counts it reports, besides `scanned`, with `counter_fields`. Each of
    those is a column of the row and an attribute of the restorer.
    """

    restorer_class = None
    counter_fields = ()

    asset_uid = models.CharField(max_length=32, verbose_name='project')
    status = models.CharField(
        default=RestoreJobStatus.PENDING,
        choices=RestoreJobStatus,
        max_length=20,
    )
    scanned = models.PositiveIntegerField(default=0)
    log = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name='+',
    )

    class Meta:
        abstract = True

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

        return cache.has_key(self.restorer_class.get_lock_cache_key(self.asset_uid))


class AttachmentRestoreJob(AbstractRestoreJob):

    restorer_class = AttachmentRestorer
    counter_fields = ('restored',)

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
    restored = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Attachment restore'
        verbose_name_plural = 'Attachment restores'


class FormVersionsRestoreJob(AbstractRestoreJob):
    """
    One launch of `restore_formversions_in_submissions` on a project.

    `restore_attachments` is the admin's `--restore-attachments`: once every
    submission is walked, the run queues an `AttachmentRestoreJob` on the same
    project, in the same mode, which then shows up and reports on its own row.
    """

    restorer_class = FormVersionsRestorer
    counter_fields = ('updated',)

    dry_run = models.BooleanField(
        default=True,
        help_text=(
            'Report the submissions that would be updated, without writing'
            ' anything. Turn this off to actually update them.'
        ),
    )
    resume = models.BooleanField(
        default=True,
        help_text=(
            'Pick up where an interrupted run stopped, rather than walking the'
            ' project from its most recent submission again.'
        ),
    )
    restore_attachments = models.BooleanField(
        default=False,
        help_text=(
            'Once every submission is walked, launch the attachment restore on'
            ' the same project, in the same mode. It can then see files kept'
            ' under a question name only an intermediate form version had.'
        ),
    )
    updated = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Form versions restore'
        verbose_name_plural = 'Form versions restores'
