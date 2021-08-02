# coding: utf-8
from datetime import timedelta

from django.db.models import Max
from django.utils import timezone

from kpi.models import AssetSnapshot
from kpi.management.delete_base_command import DeleteBaseCommand


class Command(DeleteBaseCommand):

    help = "Deletes assets snapshots"

    def _prepare_delete_queryset(self, **options):
        days = options["days"]
        self._model = AssetSnapshot

        # Retrieve Snapshots linked to assets' latest versions.
        # Use iterator to by-pass Django QuerySet caching.
        latest_version_ids = list(
            AssetSnapshot.objects.exclude(asset_version=None)
                .values("asset_id")
                .annotate(latest_version_id=Max("asset_version_id"))
                .values_list("latest_version_id", flat=True)
                .distinct()
        )

        # Retrieve all records older than days that are not linked to latest versions
        return AssetSnapshot.objects.filter(
            date_created__lt=timezone.now() - timedelta(days=days),
        ).exclude(asset_version_id__in=latest_version_ids)
