from __future__ import annotations

from django.db import models, transaction
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
    attachment_id = models.IntegerField(db_index=True, unique=True)

    class Meta(BaseTrash.Meta):
        verbose_name = 'attachment'

    def __str__(self) -> str:
        return f'{self.attachment} - {self.periodic_task.start_time}'

    @property
    def attachment(self):
        if not (_attachment := getattr(self, '_cached_attachment', None)):
            # Attachment should always exist. Do not try/except
            _attachment = Attachment.all_objects.get(pk=self.attachment_id)
            setattr(self, '_attachment', _attachment)
        return _attachment

    @classmethod
    def toggle_attachment_statuses(cls, attachment_ids: list, delete: bool = False):

        delete_status = AttachmentDeleteStatus.PENDING_DELETE if delete else None
        Attachment.all_objects.filter(pk__in=attachment_ids).update(
            delete_status=delete_status,
            date_modified=timezone.now(),
        )
