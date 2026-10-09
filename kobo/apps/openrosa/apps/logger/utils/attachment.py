from collections import defaultdict

from django.utils import timezone

from kobo.apps.openrosa.apps.logger.models import Attachment
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus


def update_delete_status(
    attachment_uids: list[str],
    from_status: AttachmentDeleteStatus | None,
    to_status: AttachmentDeleteStatus | None,
    **extra_updates,
) -> tuple[int, dict[int, int]]:
    """
    Move the attachments in `from_status` to `to_status`, and return how many
    changed, with the storage each project gains (positive) or loses
    (negative). Pass that to `update_storage_counters()`, inside the same
    transaction, as late as possible before it commits.

    Only active attachments (`delete_status` is `NULL`) count towards storage,
    so a move to or from `NULL` changes the storage, any other move does not.

    Only the rows this call changed are counted. An attachment already moved,
    e.g. trashed a moment earlier by another request, matches no row anymore:
    `update_returning()` returns the rows changed by its own `UPDATE`, in one
    query, with no lock other than the one the update takes anyway. Reading the
    rows back after the update would count it a second time.
    """

    changed_rows = Attachment.all_objects.filter(
        uid__in=attachment_uids, delete_status=from_status
    ).update_returning(
        fields=['xform_id', 'media_file_size'],
        delete_status=to_status,
        date_modified=timezone.now(),
        **extra_updates,
    )

    storage_bytes_by_xform_id = defaultdict(int)
    if (from_status is None) != (to_status is None):
        sign = 1 if to_status is None else -1
        for row in changed_rows:
            storage_bytes_by_xform_id[row['xform_id']] += sign * (
                row['media_file_size'] or 0
            )

    return len(changed_rows), dict(storage_bytes_by_xform_id)
