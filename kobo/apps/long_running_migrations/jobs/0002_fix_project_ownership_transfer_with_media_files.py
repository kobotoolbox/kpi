# Generated on 2024-12-18
from django.db.models import Q, OuterRef, Subquery

from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.openrosa.apps.main.models import MetaData
from kpi.models.asset import Asset
from kpi.models.asset_file import AssetFile
from kobo.apps.project_ownership.models import Transfer


def run():
    """
    Update OpenRosa MetaData objects that were not updated when project
    ownership was transferred to someone else. This fixes a bug introduced
    and later addressed in KPI (issue #5365).
    """

    # Step 1: Retrieve all assets that were transferred since the bug was present and
    #  use media files
    asset_uids = Asset.objects.filter(
        Q(
            pk__in=AssetFile.objects.values_list('asset_id', flat=True).exclude(
                file_type=AssetFile.PAIRED_DATA
            )
        )
        & Q(
            pk__in=Transfer.objects.values_list('asset_id', flat=True).filter(
                invite__date_created__date__gte='2024-09-15'
            )
        )
    ).values_list('uid', flat=True)

    username_subquery = XForm.objects.filter(pk=OuterRef('xform_id')).values(
        'user__username'
    )[:1]

    # Step 2: Iterate through relevant MetaData objects and fix their data_file fields
    for metadata in (
        MetaData.objects.filter(
            xform_id__in=XForm.objects.filter(
                kpi_asset_uid__in=list(asset_uids)
            ),
        )
        .exclude(
            Q(data_file__startswith=Subquery(username_subquery))
            | Q(data_file__isnull=True)
            | Q(data_file='')
        )
        .select_related('xform', 'xform__user')
        .iterator()
    ):
        data_file = str(metadata.data_file)
        old_username, *other_parts = data_file.split('/')
        other_parts.insert(0, metadata.xform.user.username)
        metadata.data_file = '/'.join(other_parts)
        metadata.save(update_fields=['data_file'])
