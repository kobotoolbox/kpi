import time

from django.conf import settings
from django.db.models.query import QuerySet

from kpi.models import AssetVersion
from kpi.utils.log import logging

# Number of records fetched per DB query. Keep small to avoid deserializing many
# large version_content blobs simultaneously.
FETCH_SIZE = 10
# Accumulate this many records before writing to DB to reduce round-trips.
BULK_UPDATE_SIZE = settings.LONG_RUNNING_MIGRATION_SMALL_BATCH_SIZE
# Pause between bulk_updates to avoid overloading the DB. With ~480k flushes
# at 48M rows, keep this short: 0.1s adds ~13h total, 2s would add 11+ days.
SLEEP_BETWEEN_FLUSHES = 0.5


def run():
    """
    Backfills the `_content_hash` field on all `AssetVersion` records that are
    missing it. Records are fetched in small batches (FETCH_SIZE) via a server-
    side cursor to avoid deserializing multiple large version_content blobs
    simultaneously. DB writes are deferred until BULK_UPDATE_SIZE records are
    ready to reduce round-trips. PK-based pagination avoids re-fetching records
    that are accumulated in memory but not yet flushed.
    """
    updates = []
    last_pk = 0

    while True:
        qs = _get_queryset(last_pk)
        batch_seen = False

        for asset_version in qs.iterator(chunk_size=FETCH_SIZE):
            batch_seen = True
            _ = asset_version.content_hash
            updates.append(asset_version)
            last_pk = asset_version.pk

            if len(updates) >= BULK_UPDATE_SIZE:
                _flush(updates)

        if not batch_seen:
            break

    _flush(updates)
    logging.info('[LRM 0020] - Done')


def _flush(updates: list):
    """
    Write accumulated updates to DB and clear the list in-place. Mutating the
    caller's list is intentional: the same list object is reused across batches.
    """
    if not updates:
        return

    logging.info(
        f'[LRM 0020] - Flushing {len(updates)} records'
        f' (pk {updates[0].pk} → {updates[-1].pk})'
    )
    AssetVersion.objects.bulk_update(updates, fields=['_content_hash'])
    updates.clear()
    time.sleep(SLEEP_BETWEEN_FLUSHES)


def _get_queryset(last_pk: int) -> QuerySet:
    return (
        AssetVersion.objects.only('pk', 'uid', 'version_content')
        .filter(_content_hash__isnull=True, pk__gt=last_pk)
        .order_by('pk')[:FETCH_SIZE]
    )
