from __future__ import annotations

from django.db import models
from django.db.utils import IntegrityError

from kobo.apps.openrosa.apps.logger.models.attachment import (
    Attachment,
    AttachmentDeleteStatus,
)
from kobo.apps.openrosa.apps.logger.utils.attachment import update_delete_status
from kobo.apps.openrosa.apps.logger.utils.counters import update_storage_counters
from kpi.deployment_backends.kc_access.utils import kc_transaction_atomic
from kpi.fields import KpiUidField
from ..type_aliases import UpdatedQuerySetAndCount
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
    def toggle_statuses(
        cls,
        object_identifiers: list[str],
        active: bool = False,
        **kwargs
    ) -> UpdatedQuerySetAndCount:
        """
        Toggle statuses of attachments based on their `uid`, and update the
        storage counters of their projects.

        See `update_delete_status()` for why only the attachments changed by
        this call are counted.
        """
        if active:
            from_status, to_status = AttachmentDeleteStatus.PENDING_DELETE, None
        else:
            from_status, to_status = None, AttachmentDeleteStatus.PENDING_DELETE

        queryset = Attachment.all_objects.filter(
            uid__in=object_identifiers, delete_status=from_status
        )
        with kc_transaction_atomic():
            updated, storage_bytes_by_xform_id = update_delete_status(
                object_identifiers, from_status=from_status, to_status=to_status
            )
            update_storage_counters(storage_bytes_by_xform_id)

        return queryset, updated
