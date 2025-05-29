from django.db import transaction
from django.db.models import F, OuterRef, Sum, Subquery
from django.db.models.functions import Coalesce
from django.db.models.query import QuerySet

from kobo.apps.openrosa.apps.logger.models import Attachment, XForm
from kobo.apps.openrosa.apps.main.models import UserProfile


def bulk_update_attachment_storage_counters(
    attachments: QuerySet[Attachment], subtract: bool
):
    """
    Update storage counters in bulk based on a queryset of attachments

    Args:
        attachments: QuerySet of Attachment objects to process.
        subtract: If True, subtract file size. If False, add file size.
    """
    sign = -1 if subtract else 1
    attachment_ids = list(attachments.values_list('pk', flat=True).distinct())
    user_ids = list(attachments.values_list('user_id', flat=True).distinct())
    xform_ids = list(attachments.values_list('xform_id', flat=True).distinct())

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

    with transaction.atomic():
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
