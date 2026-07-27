from django.conf import settings
from django.core.cache import cache
from pymongo import UpdateOne

from kobo.apps.long_running_migrations.exceptions import (
    LongRunningMigrationDependencyError,
)
from kobo.apps.long_running_migrations.models import LongRunningMigration
from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.openrosa.apps.logger.xform_instance_parser import add_uuid_prefix
from kpi.utils.log import logging

CHUNK_SIZE = settings.LONG_RUNNING_MIGRATION_SMALL_BATCH_SIZE
LAST_ID_CACHE_KEY = 'lrm_0028_last_id'


def run():
    """
    Syncs `meta/rootUuid` to MongoDB for submissions that had it backfilled in
    Postgres by LRM 0027 but experienced a partial sync failure to MongoDB.
    """
    _check_lrm_0027_is_completed()

    # Persisted across Celery restarts: instances belonging to XForms that LRM
    # 0027 permanently skips (pending_delete, or tagged failed) never get
    # `meta/rootUuid` set, so they always match the query below. Without a
    # persisted cursor, every restart would re-scan past them from `_id` 0,
    # potentially never reaching a fully empty batch within a single run.
    last_id = cache.get(LAST_ID_CACHE_KEY, 0)
    while True:
        query = {
            '_id': {'$gt': last_id},
            'meta/rootUuid': {'$exists': False},
        }

        # Paginate forward by _id to guarantee no infinite loops
        # even if a record is intentionally left un-patched.
        cursor = (
            settings.MONGO_DB.instances.find(query, {'_id': 1})
            .sort('_id', 1)
            .limit(CHUNK_SIZE)
        )
        docs = list(cursor)

        if not docs:
            cache.delete(LAST_ID_CACHE_KEY)
            break

        logging.info(
            f'[LRM 0028] - Processing batch _id {docs[0]["_id"]} to {docs[-1]["_id"]}'
        )
        _process_batch(docs)
        last_id = docs[-1]['_id']
        cache.set(LAST_ID_CACHE_KEY, last_id, timeout=None)


def _check_lrm_0027_is_completed():
    """
    Raises `LongRunningMigrationDependencyError` if LRM 0027 has not yet
    reached a terminal state (i.e.: completed).
    """

    if not LongRunningMigration.objects.filter(
        status='completed',
        name__startswith='0027',
    ).exists():
        raise LongRunningMigrationDependencyError(
            'LRM 0027 has not reached a terminal state yet'
        )


def _process_batch(docs: list):
    doc_ids = [doc['_id'] for doc in docs]

    # Only fetch Postgres records that actually have a root_uuid populated,
    # excluding trashed XForms: LRM 0027 never backfills them, but a race with
    # some other write path could leave `root_uuid` set without us wanting to
    # push it to Mongo for a project that's being deleted.
    instances_map = dict(
        Instance.objects.filter(
            pk__in=doc_ids, root_uuid__isnull=False, xform__pending_delete=False
        ).values_list('pk', 'root_uuid')
    )

    mongo_updates = [
        UpdateOne(
            {'_id': pk},
            {'$set': {'meta/rootUuid': add_uuid_prefix(root_uuid)}},
        )
        for pk, root_uuid in instances_map.items()
    ]

    if mongo_updates:
        settings.MONGO_DB.instances.bulk_write(mongo_updates, ordered=False)
