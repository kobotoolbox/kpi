from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog, AuditType
from kobo.apps.openrosa.apps.logger.models.attachment import (
    Attachment,
    AttachmentDeleteStatus,
)
from ..models.attachment import AttachmentTrash


def delete_attachment(attachment_trash: AttachmentTrash):
    attachment = attachment_trash.attachment
    attachment_id = attachment.pk
    with transaction.atomic():
        # Delete the file on storage but do not persist the change in DB.
        # Otherwise, the filename will be lost.
        attachment.media_file.delete(save=False)
        Attachment.all_objects.filter(id=attachment_id).update(
            delete_status=AttachmentDeleteStatus.DELETED,
            date_modified=timezone.now(),
        )
        attachment_trash.delete()
        AuditLog.objects.create(
            app_label=attachment._meta.app_label,
            model_name=attachment._meta.model_name,
            object_id=attachment_id,
            user=attachment_trash.request_author,
            action=AuditAction.DELETE,
            metadata={
                'attachment_uid': attachment.uid,
                'attachment_name': attachment.media_file_basename,
            },
            log_type=AuditType.ATTACHMENT_MANAGEMENT,
        )
