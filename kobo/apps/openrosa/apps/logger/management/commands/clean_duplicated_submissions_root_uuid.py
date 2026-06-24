import time

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db.utils import IntegrityError
from pymongo import UpdateOne

from kobo.apps.openrosa.apps.logger.models.instance import Instance
from kobo.apps.openrosa.apps.logger.xform_instance_parser import (
    add_uuid_prefix,
    set_meta,
)

CHUNK_SIZE = settings.LONG_RUNNING_MIGRATION_SMALL_BATCH_SIZE


class Command(BaseCommand):

    help = """
    Create a unique `root_uuid` for submissions saved before the `2.025.02` release,
    when their current `root_uuid` is already used by another submission
    within the same project."
    """

    def add_arguments(self, parser):
        super().add_arguments(parser)

        parser.add_argument(
            '--xform',
            help="Specify a XForm's `id_string`",
        )

    def handle(self, *args, **options):
        self._verbosity = options['verbosity']

        if not (xform_id_string := options.get('xform')):
            raise CommandError("XForm's `id_string` must be specified")

        try:
            exit_code = call_command(
                'clean_duplicated_submissions',
                verbosity=self._verbosity,
                xform=xform_id_string,
            )
        except Exception as e:
            exit_code = 1
            error = str(e)
        else:
            error = ''

        if exit_code:
            raise CommandError(
                f'`clean_duplicated_submissions` command has completed '
                f'with errors: {error}'
            )

        queryset = (
            Instance.objects.only('pk', 'uuid', 'xml')
            .filter(xform__id_string=xform_id_string, root_uuid__isnull=True)
        )

        while True:
            # Accumulate lightweight (pk, root_uuid) pairs — no xml kept in memory.
            # iterator(chunk_size=CHUNK_SIZE) fetches CHUNK_SIZE rows per cursor
            # batch from PostgreSQL, but only one Instance object is live in Python
            # at a time: the previous one is dereferenced (and its xml GC'd) before
            # the next is assigned to `instance`.
            update_data = []
            for instance in queryset[:CHUNK_SIZE].iterator(chunk_size=CHUNK_SIZE):
                try:
                    instance._populate_root_uuid()  # noqa
                except AssertionError:
                    # Fallback: use uuid so this instance exits the null filter
                    # and does not block the loop indefinitely.
                    instance.root_uuid = instance.uuid

                if self._verbosity >= 1:
                    self.stdout.write(
                        f'Processing root_uuid `{instance.root_uuid}`…'
                    )
                update_data.append((instance.pk, instance.root_uuid))

            if not update_data:
                break

            stubs = [
                Instance(pk=pk, root_uuid=root_uuid)
                for pk, root_uuid in update_data
            ]
            try:
                Instance.objects.bulk_update(stubs, ['root_uuid'])
                self._update_mongo_batch(update_data)
            except IntegrityError:
                for pk, root_uuid in update_data:
                    self._resolve_conflict_by_pk(pk, root_uuid, xform_id_string)

    def _resolve_conflict_by_pk(
        self, pk: int, root_uuid: str, xform_id_string: str
    ):
        try:
            Instance.objects.filter(pk=pk).update(root_uuid=root_uuid)
            settings.MONGO_DB.instances.update_one(
                {'_id': pk},
                {'$set': {'meta/rootUuid': add_uuid_prefix(root_uuid)}},
            )
        except IntegrityError:
            if self._verbosity >= 2:
                self.stdout.write(f'\tConflict detected on instance #{pk}!')

            # Load XML only now, when we actually need it for conflict resolution
            instance = Instance.objects.only('pk', 'uuid', 'xml', 'xml_hash').get(pk=pk)

            conflicting_xml_hash = Instance.objects.values_list(
                'xml_hash', flat=True
            ).get(root_uuid=root_uuid)

            # Same hash means clean_duplicated_submissions should have handled it
            if conflicting_xml_hash == instance.xml_hash:
                return

            old_uuid = instance.uuid
            now = int(time.time() * 1000)
            new_root_uuid = f'CONFLICT-{now}-{xform_id_string}-{old_uuid}'
            try:
                instance.xml = set_meta(
                    instance.xml,
                    'rootUuid',
                    add_uuid_prefix(new_root_uuid),
                )
            except ValueError:
                # instance has never been edited
                pass

            instance.xml_hash = instance.get_hash(instance.xml)
            if self._verbosity >= 2:
                self.stdout.write(
                    f'\tOld root_uuid: {old_uuid}, '
                    f'New root_uuid: {new_root_uuid}'
                )
            Instance.objects.filter(pk=pk).update(
                xml=instance.xml,
                xml_hash=instance.xml_hash,
                root_uuid=new_root_uuid,
            )
            doc = settings.MONGO_DB.instances.find_one({'_id': pk})
            doc['meta/rootUuid'] = add_uuid_prefix(new_root_uuid)
            settings.MONGO_DB.instances.replace_one({'_id': pk}, doc, upsert=True)

    @staticmethod
    def _update_mongo_batch(update_data: list):
        mongo_updates = [
            UpdateOne(
                {'_id': pk},
                {'$set': {'meta/rootUuid': add_uuid_prefix(root_uuid)}},
            )
            for pk, root_uuid in update_data
        ]
        if mongo_updates:
            settings.MONGO_DB.instances.bulk_write(mongo_updates, ordered=False)
