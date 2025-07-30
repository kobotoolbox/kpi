from __future__ import annotations

from django.db import models
from django.db.utils import IntegrityError
from django.utils import timezone

from kobo.apps.openrosa.apps.logger.models.attachment import (
    Attachment,
    AttachmentDeleteStatus,
)
from kobo.apps.openrosa.apps.logger.utils.attachment import (
    bulk_update_attachment_storage_counters
)
from kpi.deployment_backends.kc_access.utils import kc_transaction_atomic
from kpi.fields import KpiUidField
from . import BaseTrash
from ..type_aliases import UpdatedQuerySetAndCount


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
        Toggle statuses of attachments based on their `uid`.
        """
        if not active:
            current_delete_status = None
            new_delete_status = AttachmentDeleteStatus.PENDING_DELETE
            subtract = True
        else:
            current_delete_status = AttachmentDeleteStatus.PENDING_DELETE
            new_delete_status = None
            subtract = False

        queryset = Attachment.all_objects.filter(
            uid__in=object_identifiers,
            delete_status=current_delete_status
        )

        with kc_transaction_atomic():
            updated = queryset.update(
                delete_status=new_delete_status,
                date_modified=timezone.now(),
            )
            # We defer storage counter updates to run at the end of the
            # transaction block to avoid holding row-level locks for the
            # full duration of the transaction. This helps reduce contention
            # when multiple attachments are being trashed or restored
            # concurrently by different users.
            bulk_update_attachment_storage_counters(
                object_identifiers, subtract=subtract
            )
        return queryset, updated
