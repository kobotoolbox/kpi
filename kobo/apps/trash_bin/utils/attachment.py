from __future__ import annotations

from django.db import transaction
from django.utils import timezone

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
        # TODO log deletion
        attachment_trash.delete()
