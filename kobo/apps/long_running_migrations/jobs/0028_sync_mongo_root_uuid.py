from django.conf import settings
from django.db.models import Q
from pymongo import UpdateOne

from kobo.apps.long_running_migrations.exceptions import (
    LongRunningMigrationDependencyError,
)
from kobo.apps.long_running_migrations.models import LongRunningMigration
from kobo.apps.openrosa.apps.logger.models import Instance
from kobo.apps.openrosa.apps.logger.xform_instance_parser import add_uuid_prefix
from kpi.utils.log import logging


CHUNK_SIZE = settings.LONG_RUNNING_MIGRATION_SMALL_BATCH_SIZE


def run():
    """
    Syncs `meta/rootUuid` to MongoDB for submissions that had it backfilled in
    Postgres by LRM 0027 but experienced a partial sync failure to MongoDB.
    """
    _check_lrm_0027_is_completed()

    last_id = 0
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
            break

        logging.info(
            f'[LRM 0028] - Processing batch _id {docs[0]["_id"]} to {docs[-1]["_id"]}'
        )
        _process_batch(docs)
        last_id = docs[-1]['_id']


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

    # Only fetch Postgres records that actually have a root_uuid populated
    instances_map = dict(
        Instance.objects.filter(
            pk__in=doc_ids, root_uuid__isnull=False
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
