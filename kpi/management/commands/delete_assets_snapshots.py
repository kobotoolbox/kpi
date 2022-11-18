# coding: utf-8
from datetime import timedelta

from django.db.models import Max
from django.utils import timezone

from kpi.models import AssetSnapshot
from kpi.management.delete_base_command import DeleteBaseCommand


class Command(DeleteBaseCommand):

    help = "Deletes assets snapshots"

    def add_arguments(self, parser):
        super().add_arguments(parser)
        parser.add_argument(
            '--asset-id',
            default=None,
            type=str,
            help='Specify asset uid to delete on its snapshots',
        )

    def _prepare_delete_queryset(self, **options):
        days = options['days']
        asset_id = options['asset_id']
        self._model = AssetSnapshot

        # Retrieve all latest generated snapshots for each asset
        max_snapshots_qs = (
            AssetSnapshot.objects.exclude(asset_version=None)
            .values('asset_id')
            .annotate(max_snapshot_id=Max('pk'))
            .values_list('max_snapshot_id', flat=True)
        )
        if asset_id:
            max_snapshots_qs = max_snapshots_qs.filter(asset_id=asset_id)
        max_snapshot_ids = list(max_snapshots_qs)

        # Retrieve all records older than days except the latest ones
        # related to the latest versions.
        delete_queryset = AssetSnapshot.objects.filter(
            date_created__lt=timezone.now() - timedelta(days=days),
        ).exclude(pk__in=max_snapshot_ids)

        if asset_id:
            delete_queryset = delete_queryset.filter(asset_id=asset_id)

        return delete_queryset
