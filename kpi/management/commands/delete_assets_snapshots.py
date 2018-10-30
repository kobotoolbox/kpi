# -*- coding: utf-8 -*-
from __future__ import unicode_literals, absolute_import

from datetime import timedelta

from django.db.models import Max
from django.utils import timezone

from .delete_base_command import BaseCommand
from kpi.models import AssetSnapshot


class Command(BaseCommand):

    help = "Deletes assets snapshots"

    def _prepare_delete_queryset(self, **options):
        days = options["days"]
        self._model = AssetSnapshot

        # Retrieve Snapshots linked to assets' latest versions.
        # Use iterator to by-pass Django QuerySet caching.
        latest_versions_ids = [version[1] for version in AssetSnapshot.objects.values_list("asset_id").\
            annotate(latest_version_id=Max("asset_version_id")).iterator()]

        latest_versions_ids = list(set(latest_versions_ids))
        if None in latest_versions_ids:
            latest_versions_ids.remove(None)

        # Retrieve all records older than days that are not linked to latest versions
        return AssetSnapshot.objects.filter(
            date_created__lt=timezone.now() - timedelta(days=days),
        ).exclude(asset_version_id__in=latest_versions_ids)
