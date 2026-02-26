# Generated on 2025-01-16 11:58
from django.conf import settings
from django.core.management import call_command
from django.db import IntegrityError, connections
from django.db.models.query import QuerySet
from taggit.models import TaggedItem

from kobo.apps.openrosa.apps.logger.exceptions import RootUUIDConstraintNotEnforced
from kobo.apps.openrosa.apps.logger.models import Instance, XForm
from kpi.utils.database import use_db
from kpi.utils.log import logging

CHUNK_SIZE = settings.LONG_RUNNING_MIGRATION_SMALL_BATCH_SIZE


def run():
    """
    Backfills the `root_uuid` field on all `Instance` records that are missing
    it, processing xforms in batches.
    """

    _check_root_uuid_unique_index_ready()

    last_xform_id = 0
    with use_db(settings.OPENROSA_DB_ALIAS):
        while xforms := get_xforms_queryset(last_xform_id):
            for xform in xforms:
                logging.info(
                    f'[LRM 0005] - XForm #{xform.pk} ({xform.id_string}) - In Progress'
                )
                error = False
                while instances := get_instances_queryset(xform.pk):
                    if not _process_instances_batch(xform, instances):
                        error = True
                        break

                if not error:
                    xform.tags.add('kobo-root-uuid-success')

                logging.info(
                    f'[LRM 0005] - XForm #{xform.pk} ({xform.id_string}) - Done'
                )
                last_xform_id = xform.pk

        # Clean up tags while retaining failed entries for future manual review
        TaggedItem.objects.filter(tag__name='kobo-root-uuid-success').delete()


def get_instances_queryset(xform_id: int) -> QuerySet:
    # No `order_by` here: ordering would force a full table scan before the
    # `xform_id` filter can be applied, making each batch extremely slow.
    # Since we just need to exhaust all instances with a null `root_uuid` for a
    # given xform, their retrieval order does not matter.
    return (
        Instance.objects.only('pk', 'uuid', 'xml', 'root_uuid')
        .filter(root_uuid__isnull=True, xform_id=xform_id)[:CHUNK_SIZE]
    )


def get_xforms_queryset(xform_id: int) -> QuerySet:
    # `order_by('pk')` is inexpensive here because `pk` is the primary key and
    # already indexed. Combined with the `CHUNK_SIZE` limit, each batch is
    # fetched quickly without scanning the full table.
    return (
        XForm.objects.only('pk', 'id_string')
        .filter(pk__gt=xform_id)
        .exclude(tags__name__contains='kobo-root-uuid')
        .order_by('pk')[:CHUNK_SIZE]
    )


def _check_root_uuid_unique_index_ready():
    with connections[settings.OPENROSA_DB_ALIAS].cursor() as cursor:
        cursor.execute(
            """
            SELECT ix.indisvalid
            FROM pg_indexes i
            JOIN pg_class c ON c.relname = i.indexname
            JOIN pg_index ix ON ix.indexrelid = c.oid
            WHERE i.tablename = %s AND i.indexname = %s
        """,
            ['logger_instance', 'unique_root_uuid_per_xform'],
        )
        row = cursor.fetchone()
        if not (row is not None and row[0]):
            raise RootUUIDConstraintNotEnforced(
                'The unique index on "root_uuid" is missing or invalid.\n'
                'Make sure the migration `logger.0041_add_root_uuid_field_to_instance` '
                'has been applied and that the constraint was successfully created. '
                'Once that is done, re-run this migration (by setting its status back '
                'to "CREATED" in the admin interface).'
            )


def _process_instances_batch(
    xform: XForm, instance_queryset: QuerySet, first_try=True
) -> bool:
    instance_batch_ids = []
    instance_batch = []
    for instance in instance_queryset.iterator():
        try:
            instance._populate_root_uuid()  # noqa
        except AssertionError as e:
            if 'root_uuid should not be empty' in str(e):
                # fallback on `uuid` to back-fill `root_uuid`
                instance.root_uuid = instance.uuid

        instance_batch_ids.append(instance.pk)
        instance_batch.append(instance)

    try:
        Instance.objects.bulk_update(instance_batch, fields=['root_uuid'])
    except IntegrityError:
        if first_try:
            try:
                call_command(
                    'clean_duplicated_submissions',
                    xform=xform.id_string,
                    verbosity=2,
                )
            except Exception as e:
                logging.error(
                    f'[LRM 0005] - Failed to clean duplicated submissions: {str(e)}'
                )
                xform.tags.add('kobo-root-uuid-failed')
                return False

            # Need to reload instance_batch to get new uuids
            instance_batch_retry = Instance.objects.only(
                'pk', 'uuid', 'xml', 'root_uuid'
            ).filter(pk__in=instance_batch_ids)
            return _process_instances_batch(
                xform, instance_batch_retry, first_try=False
            )
        else:
            xform.tags.add('kobo-root-uuid-failed')
            return False
    else:
        return True
