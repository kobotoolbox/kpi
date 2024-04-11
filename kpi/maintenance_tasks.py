import constance
from datetime import timedelta

from django.db.models import Max
from django.utils import timezone

from kpi.models import AssetSnapshot


default_retention_period = 90

def remove_old_assetsnapshots():
    days = (
        constance.config.ASSET_SNAPSHOT_DAYS_RETENTION
        or default_retention_period
    )
    max_snapshots_qs = (
        AssetSnapshot.objects.exclude(asset_version=None)
        .values('asset_id')
        .annotate(max_snapshot_id=Max('pk'))
        .values_list('max_snapshot_id', flat=True)
    )

    max_snapshot_ids = list(max_snapshots_qs)

    delete_queryset = AssetSnapshot.objects.filter(
        date_created__lt=timezone.now() - timedelta(days=days),
    ).exclude(pk__in=max_snapshot_ids).order_by('pk')

    while True:
        try:
            deletion_delimiter = delete_queryset.values_list('pk', flat=True)[
                1000:1001
            ].get()
            delete_queryset.filter(id__lte=deletion_delimiter).delete()
        except AssetSnapshot.DoesNotExist:
            break
        
    delete_queryset.delete()
