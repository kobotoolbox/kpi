from django.db.models import F, OuterRef, Sum, Subquery
from django.db.models.functions import Coalesce

from kobo.apps.openrosa.apps.logger.models import Attachment, XForm
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kobo.apps.openrosa.apps.main.models import UserProfile
from kpi.deployment_backends.kc_access.utils import conditional_kc_transaction_atomic


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
        UserProfile.objects.filter(user_id__in=user_ids).update(
            attachment_storage_bytes=(
                F('attachment_storage_bytes') +
                sign * Coalesce(Subquery(user_profile_subquery), 0)
            )
        )

        XForm.all_objects.filter(pk__in=xform_ids).update(
            attachment_storage_bytes=(
                F('attachment_storage_bytes') +
                sign * Coalesce(Subquery(xform_subquery), 0)
            )
        )


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
