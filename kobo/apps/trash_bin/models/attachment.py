from __future__ import annotations

from django.db import models
from django.db.utils import IntegrityError
from django.utils import timezone

from kobo.apps.openrosa.apps.logger.models.attachment import (
    Attachment,
    AttachmentDeleteStatus,
)
from kpi.fields import KpiUidField
from . import BaseTrash


class AttachmentTrash(BaseTrash):

    uid = KpiUidField(uid_prefix='attt')
    # Cannot use foreign key on Attachment, because it belongs to Kobocat
    # database. Use property @attachment to simulate the FK.
    # TODO use FK when databases are merged
    attachment_id = models.IntegerField(db_index=True, unique=True, default=0)

    class Meta(BaseTrash.Meta):
        verbose_name = 'attachment'

    def __str__(self) -> str:
        return f'{self.attachment} - {self.periodic_task.clocked.clocked_time}'

    @property
    def attachment(self):
        if not (_attachment := getattr(self, '_cached_attachment', None)):
            # Attachment should always exist. Do not try/except
            _attachment = Attachment.all_objects.get(pk=self.attachment_id)
            setattr(self, '_attachment', _attachment)
        return _attachment

    def save(self, *args, **kwargs):
        try:
            self.attachment
        except Attachment.DoesNotExist:
            message = (
                'insert or update on table "trashbin_attachmentrash" violates foreign '
                'key constraint "trashbin_attachmentrash_attachment_id__fk"\n'
                f'DETAIL:  Key (attachment_id)=({self.attachment_id}) is not present '
                f'in table "logger_attachment".'
            )
            raise IntegrityError(message)

        super().save(*args, **kwargs)

    @classmethod
    def toggle_statuses(cls, object_identifiers: list[str], active: bool = False):
        """
        Toggle statuses of attachments based on their `uid`.
        """
        delete_status = AttachmentDeleteStatus.PENDING_DELETE if not active else None
        Attachment.all_objects.filter(uid__in=object_identifiers).update(
            delete_status=delete_status,
            date_modified=timezone.now(),
        )
