import time

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.core.management import call_command
from django.db.utils import IntegrityError

from kobo.apps.openrosa.apps.logger.models.instance import Instance
from kobo.apps.openrosa.apps.logger.xform_instance_parser import (
    set_meta,
    add_uuid_prefix,
)


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

        # First
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

        # Retrieve all instances with the same `uuid`
        queryset = Instance.objects.filter(
            xform__id_string=xform_id_string, root_uuid__isnull=True
        )

        for instance in queryset.iterator():
            try:
                instance._populate_root_uuid()  # noqa
                if self._verbosity >= 1:
                    self.stdout.write(
                        f'Processing root_uuid `{instance.root_uuid}`…'
                    )
                # Bypass Instance.save() mechanism
                Instance.objects.filter(pk=instance.pk).update(
                    root_uuid=instance.root_uuid
                )
            except IntegrityError as e:
                if 'unique_root_uuid_per_xform' not in str(e):
                    self.stderr.write(
                        f'Could not update instance #{instance.pk} '
                        f'- uuid: {instance.uuid}'
                    )

                if self._verbosity >= 2:
                    self.stdout.write('\tConflict detected!')

                xml_hash = Instance.objects.values_list(
                    'xml_hash', flat=True
                ).get(root_uuid=instance.root_uuid)
                # Only consider different hashes, because if there are the
                # same, they should have been handled by clean_duplicated_submissions
                # management command
                if xml_hash != instance.xml_hash:
                    old_uuid = instance.uuid
                    now = int(time.time() * 1000)
                    instance.root_uuid = (
                        f'CONFLICT-{now}-{xform_id_string}-{old_uuid}'
                    )
                    try:
                        instance.xml = set_meta(
                            instance.xml,
                            'rootUuid',
                            add_uuid_prefix(instance.root_uuid),
                        )
                    except ValueError:
                        # instance has never been edited
                        pass

                    instance.xml_hash = instance.get_hash(instance.xml)
                    if self._verbosity >= 2:
                        self.stdout.write(
                            f'\tOld root_uuid: {old_uuid}, '
                            f'New UUID: {instance.root_uuid}'
                        )
                    # Bypass Instance.save() mechanism
                    Instance.objects.filter(pk=instance.pk).update(
                        xml=instance.xml,
                        xml_hash=instance.xml_hash,
                        root_uuid=instance.root_uuid
                    )
                    doc = settings.MONGO_DB.instances.find_one(
                        {'_id': instance.pk}
                    )
                    doc['meta/rootUuid'] = add_uuid_prefix(instance.root_uuid)
                    settings.MONGO_DB.instances.replace_one(
                        {'_id': instance.pk}, doc, upsert=True
                    )
            except AssertionError:
                self.stderr.write(
                    f'Could not update root_uuid of instance #{instance.pk} '
                    f'- uuid: {instance.uuid}'
                )
