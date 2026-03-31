import time

from django.db.models.query import QuerySet

from kpi.models import AssetVersion
from kpi.utils.log import logging

# Keep chunk size small to avoid loading large version_content JSON blobs into
# memory all at once — trading speed for a lower memory footprint.
CHUNK_SIZE = 5


def run():
    """
    Backfills the `_content_hash` field on all `AssetVersion` records that are
    missing it, processing records in small batches to avoid loading too much
    `version_content` JSON into memory at once.
    """

    while asset_versions := get_queryset():
        updates = []
        for asset_version in asset_versions.iterator(chunk_size=CHUNK_SIZE):
            logging.info(
                f'[LRM 0020] - AssetVersion #{asset_version.uid} - In Progress'
            )
            _ = asset_version.content_hash
            updates.append(asset_version)

        AssetVersion.objects.bulk_update(updates, fields=['_content_hash'])
        # Do not flood the DB.
        time.sleep(2)


def get_queryset() -> QuerySet:
    return AssetVersion.objects.only('pk', 'uid', 'version_content').filter(
        _content_hash__isnull=True
    )[:CHUNK_SIZE]
