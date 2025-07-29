# Generated on 2025-01-16 11:58
from typing import Union

from django.conf import settings
from django.core.management import call_command
from django.db import IntegrityError, connections
from django.db.models.query import QuerySet
from taggit.models import TaggedItem

from kobo.apps.openrosa.apps.logger.exceptions import RootUUIDConstraintNotEnforced
from kobo.apps.openrosa.apps.logger.models import Instance, XForm
from kpi.utils.database import use_db
from kpi.utils.log import logging

CHUNK_SIZE = settings.LONG_RUNNING_MIGRATION_BATCH_SIZE


def run():
    """
    Transfers all assets owned by members to their respective organizations.
    """

    _check_root_uuid_unique_index_ready()

    last_xform_id = 0
    with use_db(settings.OPENROSA_DB_ALIAS):
        while xforms := get_xforms_queryset(last_xform_id):
            for xform in xforms:
                last_instance_id = 0
                error = False
                while instances := get_instances_queryset(last_instance_id, xform.pk):
                    if not (instance_ids := _process_instances_batch(xform, instances)):
                        error = True
                        break
                    last_instance_id = instance_ids[-1]

                if not error:
                    xform.tags.add('kobo-root-uuid-success')

        # Clean up tags while retaining failed entries for future manual review
        TaggedItem.objects.filter(tag__name='kobo-root-uuid-success').delete()


def get_instances_queryset(instance_id: int, xform_id: int) -> QuerySet[Instance]:
    return (
        Instance.objects.only('pk', 'uuid', 'xml', 'root_uuid')
        .filter(root_uuid__isnull=True, xform_id=xform_id, pk__gt=instance_id)
        .order_by('pk')[:CHUNK_SIZE]
    )


def get_xforms_queryset(xform_id: int) -> QuerySet[XForm]:
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
    xform: XForm, instance_queryset: QuerySet[Instance], first_try=True
) -> Union[bool, list[int]]:
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
                logging.error(f'Failed to clean duplicated submissions: {str(e)}')
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
        return instance_batch_ids
