# Generated on 2025-01-16 11:58
from django.conf import settings
from django.core.management import call_command
from django.db import IntegrityError, connections
from more_itertools import chunked
from taggit.models import TaggedItem

from kobo.apps.openrosa.apps.logger.exceptions import RootUUIDConstraintNotEnforced
from kobo.apps.openrosa.apps.logger.models import Instance, XForm
from kpi.utils.database import use_db
from kpi.utils.log import logging


def run():
    """
    Transfers all assets owned by members to their respective organizations.
    """
    CHUNK_SIZE = settings.LONG_RUNNING_MIGRATION_BATCH_SIZE

    _check_root_uuid_unique_index_ready()

    with use_db(settings.OPENROSA_DB_ALIAS):
        xforms = XForm.objects.only('pk', 'id_string').exclude(
            tags__name__contains='kobo-root-uuid'
        ).iterator()
        for xform_batch in chunked(xforms, CHUNK_SIZE):
            for xform in xform_batch:
                instances = Instance.objects.only(
                    'pk', 'uuid', 'xml', 'root_uuid'
                ).filter(root_uuid__isnull=True, xform_id=xform.pk).iterator()
                error = False
                for instance_batch in chunked(instances, CHUNK_SIZE):
                    if not _process_instances_batch(xform, instance_batch):
                        error = True
                        break

                if not error:
                    xform.tags.add('kobo-root-uuid-success')

        # Clean up tags while retaining failed entries for future manual review
        TaggedItem.objects.filter(tag__name='kobo-root-uuid-success').delete()


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
    xform: XForm, instance_batch: list[Instance], first_try=True
) -> bool:
    for instance in instance_batch:
        try:
            instance._populate_root_uuid()  # noqa
        except AssertionError as e:
            if 'root_uuid should not be empty' in str(e):
                # fallback on `uuid` to back-fill `root_uuid`
                instance.root_uuid = instance.uuid
    try:
        Instance.objects.bulk_update(
            instance_batch, fields=['root_uuid']
        )
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
            instance_batch = Instance.objects.only(
                'pk', 'uuid', 'xml', 'root_uuid'
            ).filter(pk__in=[instance.pk for instance in instance_batch])
            return _process_instances_batch(
                xform, instance_batch, first_try=False
            )
        else:
            xform.tags.add('kobo-root-uuid-failed')
            return False
    else:
        return True
