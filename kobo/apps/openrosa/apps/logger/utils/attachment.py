from collections import defaultdict

from django.db.models import (
    BigIntegerField,
    Case,
    F,
    OuterRef,
    Subquery,
    Sum,
    Value,
    When,
)
from django.db.models.functions import Coalesce
from django.utils import timezone

from kobo.apps.openrosa.apps.logger.models import Attachment, XForm
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kobo.apps.openrosa.apps.main.models import UserProfile
from kpi.deployment_backends.kc_access.utils import (
    conditional_kc_transaction_atomic,
    kc_transaction_atomic,
)


def bulk_update_attachment_storage_counters(
    attachment_identifiers: list[str], subtract: bool
):
    """
    Update storage counters in bulk based on a queryset of attachments.

    Args:
        attachment_identifiers (list[str]): List of attachment UIDs to update.
        subtract (bool): If True, subtract the size from the counters.
                         If False, add the size to the counters.
    """
    sign = -1 if subtract else 1
    target_delete_status = (
        AttachmentDeleteStatus.PENDING_DELETE if subtract else None
    )

    attachments = Attachment.all_objects.filter(
        uid__in=attachment_identifiers,
        delete_status=target_delete_status
    )
    if not attachments.exists():
        return

    attachment_ids = attachments.values_list('pk', flat=True)
    user_ids = attachments.values_list('user_id', flat=True)
    xform_ids = attachments.values_list('xform_id', flat=True)

    user_profile_subquery = (
        Attachment.all_objects
        .filter(user_id=OuterRef('user_id'), pk__in=attachment_ids)
        .values('user_id')
        .annotate(total_size=Sum('media_file_size'))
        .values('total_size')
    )

    xform_subquery = (
        Attachment.all_objects
        .filter(xform_id=OuterRef('pk'), pk__in=attachment_ids)
        .values('xform_id')
        .annotate(total_size=Sum('media_file_size'))
        .values('total_size')
    )

    with conditional_kc_transaction_atomic():
        XForm.all_objects.filter(pk__in=xform_ids).update(
            attachment_storage_bytes=(
                F('attachment_storage_bytes')
                + sign * Coalesce(Subquery(xform_subquery), 0)
            )
        )

        UserProfile.objects.filter(user_id__in=user_ids).update(
            attachment_storage_bytes=(
                F('attachment_storage_bytes') +
                sign * Coalesce(Subquery(user_profile_subquery), 0)
            )
        )


def toggle_delete_status_and_storage_counters(
    attachment_uids: list[str], active: bool
) -> int:
    """
    Move attachments to trash (`active=False`) or put them back
    (`active=True`), and update the storage counters of their users and
    projects. Return how many attachments were changed.

    Only the attachments this call changed are counted. An attachment already
    in the target state, e.g. trashed a moment earlier by another request, is
    neither changed nor counted. Reading the rows back after the update, as
    `bulk_update_attachment_storage_counters()` does, would count it a second
    time, because it cannot tell which call changed it.

    `update_returning()` returns the rows changed by its own `UPDATE`, in one
    query, with no lock other than the one the update takes anyway.
    """
    if active:
        current_status = AttachmentDeleteStatus.PENDING_DELETE
        new_status = None
        sign = 1
    else:
        current_status = None
        new_status = AttachmentDeleteStatus.PENDING_DELETE
        sign = -1

    with kc_transaction_atomic():
        changed_rows = Attachment.all_objects.filter(
            uid__in=attachment_uids, delete_status=current_status
        ).update_returning(
            fields=['user_id', 'xform_id', 'media_file_size'],
            delete_status=new_status,
            date_modified=timezone.now(),
        )
        if not changed_rows:
            return 0

        bytes_per_user = defaultdict(int)
        bytes_per_xform = defaultdict(int)
        for row in changed_rows:
            bytes_per_user[row['user_id']] += row['media_file_size'] or 0
            bytes_per_xform[row['xform_id']] += row['media_file_size'] or 0

        # Projects first and user profiles last, like `update_user_counters()`
        # does for each submission, so both cannot deadlock and the profile
        # rows stay locked as briefly as possible.
        XForm.all_objects.bulk_update(
            [
                XForm(
                    pk=xform_id,
                    attachment_storage_bytes=F('attachment_storage_bytes')
                    + sign * size,
                )
                for xform_id, size in bytes_per_xform.items()
            ],
            ['attachment_storage_bytes'],
        )
        # Same SQL as `bulk_update()` (one `UPDATE` with a `CASE` per row), but
        # keyed on `user_id`, because `bulk_update()` needs the profile pk,
        # which would cost an extra query.
        UserProfile.objects.filter(user_id__in=bytes_per_user).update(
            attachment_storage_bytes=F('attachment_storage_bytes')
            + Case(
                *[
                    When(user_id=user_id, then=Value(sign * size))
                    for user_id, size in bytes_per_user.items()
                ],
                output_field=BigIntegerField(),
            )
        )

    return len(changed_rows)


def update_user_attachment_storage_counters(
    xform_identifiers: list[str], subtract: bool
):
    """
    Update user attachment storage counters based on xform identifiers.

    This function does not update storage counters on the XForm itself.
    Trashed/restored projects retain their attachments, but only UserProfile
    storage is updated to keep global usage reporting accurate. Since trashed
    XForms are excluded from the queries, updating only UserProfile ensures
    consistency without affecting form-level data.
    """
    sign = -1 if subtract else 1
    user_ids = XForm.all_objects.filter(
        kpi_asset_uid__in=xform_identifiers
    ).values_list('user_id', flat=True).distinct()

    user_storage_subquery = (
        XForm.all_objects
        .filter(user_id=OuterRef('user_id'), kpi_asset_uid__in=xform_identifiers)
        .values('user_id')
        .annotate(storage_bytes=Sum('attachment_storage_bytes'))
        .values('storage_bytes')
    )

    UserProfile.objects.filter(user_id__in=user_ids).update(
        attachment_storage_bytes=(
            F('attachment_storage_bytes') +
            sign * Coalesce(Subquery(user_storage_subquery), 0))
    )
