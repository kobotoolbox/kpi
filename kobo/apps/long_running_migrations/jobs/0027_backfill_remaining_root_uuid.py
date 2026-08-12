# Generated on 2026-06-23

from celery.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded
from django.conf import settings
from django.core.cache import cache
from django.core.management import call_command
from django.db import IntegrityError, connections
from django.db.models import Q
from django.db.models.query import QuerySet
from pymongo import UpdateOne

from kobo.apps.long_running_migrations.exceptions import (
    LongRunningMigrationDependencyError,
)
from kobo.apps.long_running_migrations.models import LongRunningMigration
from kobo.apps.openrosa.apps.logger.models import Instance, XForm
from kobo.apps.openrosa.apps.logger.xform_instance_parser import add_uuid_prefix
from kpi.utils.database import use_db
from kpi.utils.log import logging

CHUNK_SIZE = settings.LONG_RUNNING_MIGRATION_SMALL_BATCH_SIZE
FAILED_TAG = 'kobo-root-uuid-failed-0027'
LAST_XFORM_ID_CACHE_KEY = 'lrm_0027_last_xform_id'


def run():
    """
    Backfills `root_uuid` and `meta/rootUuid` for any Instance records missed
    by LRM 0005 (e.g. due to the taggit multi-DB routing bug).

    Requires LRM 0005 to be in a terminal state (completed or failed) before
    starting; retries on the next Celery beat cycle otherwise.

    Tracking strategy:
    - No success tag: the absence of null `root_uuid` instances proves completion.
    - A `kobo-root-uuid-failed-0026` tag (written directly to the KoboCAT DB)
      marks XForms with unrecoverable errors so they are permanently skipped.
    """

    _check_lrm_0005_is_completed()

    # Persisted across Celery restarts: instances belonging to XForms this job
    # permanently skips (pending_delete, or tagged failed) never get a
    # `root_uuid`, so they always match the query in `get_xforms_queryset`.
    # Without a persisted cursor, every restart would re-scan past them from
    # XForm pk 0, potentially never reaching a fully empty batch within a
    # single run.
    last_xform_id = cache.get(LAST_XFORM_ID_CACHE_KEY, 0)
    with use_db(settings.OPENROSA_DB_ALIAS):
        while True:
            xforms, next_xform_id = get_xforms_queryset(last_xform_id)
            if next_xform_id == -1:
                cache.delete(LAST_XFORM_ID_CACHE_KEY)
                break
            for xform in xforms:
                logging.info(
                    f'[LRM 0027] - XForm #{xform.pk} ({xform.id_string}) - In Progress'
                )
                error = False
                while instances := get_instances_queryset(xform.pk):
                    if not _process_instances_batch(xform, instances):
                        error = True
                        break

                if not error:
                    logging.info(
                        f'[LRM 0027] - XForm #{xform.pk} ({xform.id_string}) - Done'
                    )

            # Only advance the persisted cursor once every XForm in this batch
            # has reached a terminal outcome (done or tagged failed), so a
            # crash mid-batch re-processes the same small batch on restart
            # instead of permanently skipping whatever wasn't finished yet.
            last_xform_id = next_xform_id
            cache.set(LAST_XFORM_ID_CACHE_KEY, last_xform_id, timeout=None)


def get_instances_queryset(xform_id: int) -> QuerySet:
    # No `order_by` here: ordering would force a full table scan before the
    # `xform_id` filter can be applied, making each batch extremely slow.
    # Since we just need to exhaust all instances with a null `root_uuid` for a
    # given xform, their retrieval order does not matter.
    return Instance.objects.only('pk', 'uuid', 'xml', 'root_uuid').filter(
        root_uuid__isnull=True, xform_id=xform_id
    )[:CHUNK_SIZE]


def get_xforms_queryset(xform_id: int) -> tuple[QuerySet, int]:
    """
    Returns `(queryset, next_xform_id)` where `next_xform_id` is the highest
    candidate XForm PK seen (including failed ones), or -1 if there is no more
    work. The caller must use `next_xform_id` — not `queryset` results — to
    advance the pagination cursor, so that permanently-failed XForms at lower
    PKs never block XForms with higher PKs.

    Both the null-check and the failed-tag exclusion run within the kobocat DB
    connection, avoiding cross-DB routing issues.
    """

    xform_ids = _get_next_distinct_xform_ids(xform_id)

    if not xform_ids:
        return XForm.objects.none(), -1

    return (
        XForm.objects.only('pk', 'id_string')
        .filter(pk__in=xform_ids)
        .exclude(tags__name__contains=FAILED_TAG)
        .order_by('pk')[:CHUNK_SIZE],
        max(xform_ids),
    )


def _check_lrm_0005_is_completed():
    """
    Raises `LongRunningMigrationDependencyError` if LRM 0005 has not yet
    reached a terminal state (completed or failed). The caller's `execute()`
    catches this exception and retries on the next Celery beat cycle instead
    of marking this migration as failed.
    """

    if not LongRunningMigration.objects.filter(
        Q(status='completed') | Q(status='failed'),
        name__startswith='0005',
    ).exists():
        raise LongRunningMigrationDependencyError(
            'LRM 0005 has not reached a terminal state yet'
        )


def _find_timeout_in_chain(exc: BaseException) -> BaseException | None:
    """
    Walk the exception's cause/context chain and return the first Celery
    timeout found, or `None`. A lower layer may catch a timeout and re-raise it
    wrapped in another exception type, which would otherwise be mistaken for an
    unrecoverable data error.
    """

    seen = set()
    current = exc
    while current is not None and id(current) not in seen:
        if isinstance(current, (SoftTimeLimitExceeded, TimeLimitExceeded)):
            return current
        seen.add(id(current))
        current = current.__cause__ or current.__context__

    return None


def _get_next_distinct_xform_ids(xform_id: int) -> list[int]:
    """
    Returns up to `CHUNK_SIZE` distinct `xform_id`s greater than `xform_id`
    that still have at least one `Instance` with a null `root_uuid`.

    PostgreSQL has no native loose ("skip") index scan, so a plain
    `SELECT DISTINCT xform_id ... ORDER BY xform_id LIMIT` walks every
    matching index entry in order, including duplicates, before it can move
    on to the next distinct value. When a single XForm has millions of
    null-`root_uuid` instances, that forces the scan to read all of them just
    to advance past it, which can exceed `statement_timeout`. This recursive
    CTE instead seeks directly to the next distinct `xform_id` at each step.
    """

    with connections[settings.OPENROSA_DB_ALIAS].cursor() as cursor:
        cursor.execute(
            """
            WITH RECURSIVE cursor_walk AS (
                (
                    SELECT xform_id
                    FROM logger_instance
                    WHERE root_uuid IS NULL AND xform_id > %(xform_id)s
                    ORDER BY xform_id
                    LIMIT 1
                )
                UNION ALL
                SELECT (
                    SELECT xform_id
                    FROM logger_instance
                    WHERE root_uuid IS NULL AND xform_id > cursor_walk.xform_id
                    ORDER BY xform_id
                    LIMIT 1
                )
                FROM cursor_walk
                WHERE cursor_walk.xform_id IS NOT NULL
            )
            SELECT xform_id
            FROM cursor_walk
            WHERE xform_id IS NOT NULL
            LIMIT %(chunk_size)s
            """,
            {'xform_id': xform_id, 'chunk_size': CHUNK_SIZE},
        )
        return [row[0] for row in cursor.fetchall()]


def _process_instances_batch(
    xform: XForm, instance_queryset: QuerySet, first_try=True
) -> bool:
    instance_batch_ids = []
    instance_batch = []
    for instance in instance_queryset.iterator(chunk_size=CHUNK_SIZE):
        try:
            instance._populate_root_uuid()  # noqa
        except AssertionError as e:
            if 'root_uuid should not be empty' in str(e):
                # fallback on `uuid` to back-fill `root_uuid`
                instance.root_uuid = instance.uuid
            else:
                raise

        instance_batch_ids.append(instance.pk)
        instance_batch.append(instance)

    try:
        Instance.objects.bulk_update(instance_batch, fields=['root_uuid'])
    except IntegrityError:
        if first_try:
            logging.info(
                f'[LRM 0027] - XForm #{xform.pk} ({xform.id_string}) - '
                f'Cleaning duplicated submissions'
            )
            try:
                call_command(
                    'clean_duplicated_submissions_root_uuid',
                    xform=xform.id_string,
                    verbosity=2,
                )
            except (SoftTimeLimitExceeded, TimeLimitExceeded):
                # Celery interrupted the command mid-run: this is not an
                # unrecoverable data error, so do not tag the XForm as failed.
                # Let it propagate to `execute()`, which resumes on the next
                # Celery beat cycle.
                raise
            except Exception as e:
                # A lower layer may have caught a Celery timeout and re-raised
                # it wrapped in another exception type (e.g. CommandError).
                # Treat it as a timeout, not an unrecoverable data error.
                if timeout := _find_timeout_in_chain(e):
                    raise timeout
                logging.error(
                    f'[LRM 0027] - Failed to clean duplicated submissions: {str(e)}'
                )
                xform.tags.add(FAILED_TAG)
                return False

            logging.info(
                f'[LRM 0027] - XForm #{xform.pk} ({xform.id_string}) - '
                f'Cleaned duplicated submissions!'
            )

            # Need to reload instance_batch to get updated root_uuids
            instance_batch_retry = Instance.objects.only(
                'pk', 'uuid', 'xml', 'root_uuid'
            ).filter(pk__in=instance_batch_ids)
            return _process_instances_batch(
                xform, instance_batch_retry, first_try=False
            )
        else:
            xform.tags.add(FAILED_TAG)
            return False
    else:
        _update_mongo_batch(instance_batch)
        return True


def _update_mongo_batch(instances: list):
    mongo_updates = [
        UpdateOne(
            {'_id': instance.pk},
            {'$set': {'meta/rootUuid': add_uuid_prefix(instance.root_uuid)}},
        )
        for instance in instances
    ]
    if mongo_updates:
        settings.MONGO_DB.instances.bulk_write(mongo_updates, ordered=False)
