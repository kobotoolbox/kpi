from collections import defaultdict
from collections.abc import Iterator

from django.conf import settings
from django.utils import timezone

from kobo.apps.openrosa.apps.logger.models import Attachment, XForm
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kpi.utils.django_orm_helper import get_distinct_values


def get_suspected_drifted_xform_ids(last_xform_id: int = 0) -> Iterator[list[int]]:
    """
    Yield, in batches and in increasing order, the ids of the projects whose
    storage counter may have drifted: those holding at least one attachment
    that left the active status (trashed, restored, soft deleted). A project
    whose attachments were only ever added cannot drift.

    `last_xform_id` resumes after a given project.

    The projects come from the partial index on inactive attachments, walked
    by `get_distinct_values()`: a plain `SELECT DISTINCT` would read every
    entry of it, millions, to keep a few thousand projects.
    """

    inactive_attachments = Attachment.all_objects.filter(delete_status__isnull=False)
    while xform_ids := get_distinct_values(
        inactive_attachments,
        'xform_id',
        last_value=last_xform_id,
        limit=settings.DEFAULT_BATCH_SIZE,
    ):
        yield xform_ids
        last_xform_id = xform_ids[-1]


def get_xform_ids_with_negative_storage() -> list[int]:
    """
    Return the ids of the projects whose storage counter is negative, which can
    only be wrong
    """

    return list(
        XForm.all_objects.filter(attachment_storage_bytes__lt=0)
        .order_by('pk')
        .values_list('pk', flat=True)
    )


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
