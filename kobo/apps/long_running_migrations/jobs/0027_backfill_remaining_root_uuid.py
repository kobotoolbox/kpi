# Generated on 2026-06-23

from django.conf import settings
from django.core.management import call_command
from django.db import IntegrityError
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

    last_xform_id = 0
    with use_db(settings.OPENROSA_DB_ALIAS):
        while True:
            xforms, last_xform_id = get_xforms_queryset(last_xform_id)
            if last_xform_id == -1:
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

    xform_ids = list(
        Instance.objects.filter(root_uuid__isnull=True)
        .values_list('xform_id', flat=True)
        .filter(xform_id__gt=xform_id)
        .distinct()
        .order_by('xform_id')[:CHUNK_SIZE]
    )

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
            try:
                call_command(
                    'clean_duplicated_submissions_root_uuid',
                    xform=xform.id_string,
                    verbosity=2,
                )
            except Exception as e:
                logging.error(
                    f'[LRM 0027] - Failed to clean duplicated submissions: {str(e)}'
                )
                xform.tags.add(FAILED_TAG)
                return False

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
