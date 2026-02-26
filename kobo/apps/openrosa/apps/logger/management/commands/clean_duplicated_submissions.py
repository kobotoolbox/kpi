import time
from collections import defaultdict

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.models import F, QuerySet
from django.db.models.aggregates import Count
from more_itertools import chunked

from kobo.apps.openrosa.apps.logger.models import (
    DailyXFormSubmissionCounter,
    MonthlyXFormSubmissionCounter,
)
from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kobo.apps.openrosa.apps.logger.models.instance import Instance
from kobo.apps.openrosa.apps.logger.utils import delete_instances
from kobo.apps.openrosa.apps.logger.xform_instance_parser import set_meta
from kobo.apps.openrosa.apps.viewer.models.parsed_instance import ParsedInstance
from kpi.deployment_backends.kc_access.utils import kc_transaction_atomic


class Command(BaseCommand):

    help = """
    Deletes or updates duplicated submissions based on uuid and xml_hash.

    Workflow:
    1. Identifies submissions with duplicate uuids.
    2. For duplicates with the same xml_hash, deletes duplicates and attaches
    their attachments to the original submission.
    3. For duplicates with different xml_hashes, updates their uuids to make
    them unique.
    """

    def add_arguments(self, parser):
        super().add_arguments(parser)

        parser.add_argument(
            '--user',
            default=None,
            help='Specify a username to clean up only their forms',
        )

        parser.add_argument(
            '--xform',
            default=None,
            help="Specify a XForm's `id_string` to clean up only this form",
        )

    def handle(self, *args, **options):
        self._verbosity = options['verbosity']

        # Retrieve all instances with the same `uuid`
        queryset = self._filter_queryset(
            Instance.objects.values('uuid', 'xform_id')
            .annotate(count_uuid=Count('uuid'))
            .filter(count_uuid__gt=1),
            **options,
        )

        for result in queryset.iterator():
            uuid = result['uuid']
            xform_id = result['xform_id']

            if self._verbosity >= 1:
                self.stdout.write(f'\tProcessing uuid `{uuid}` in XForm #{xform_id}…')

            # Get all instances with the same UUID
            duplicates_queryset = (
                Instance.objects.filter(uuid=uuid, xform_id=xform_id)
                .values('id', 'uuid', 'xml_hash', 'xform_id', 'date_created')
                .order_by('uuid', 'date_created')
            )

            # Separate duplicates by their xml_hash (same and different)
            same_xml_hash_duplicates, different_xml_hash_duplicates = (
                self._get_duplicates_by_xml_hash(duplicates_queryset)
            )

            # Handle the same xml_hash duplicates
            if same_xml_hash_duplicates:
                instance_ref = same_xml_hash_duplicates.pop(0)
                self._delete_duplicates(instance_ref, same_xml_hash_duplicates)

            # Handle the different xml_hash duplicates (update uuid)
            if different_xml_hash_duplicates:
                self._replace_duplicates(different_xml_hash_duplicates)

    def _delete_duplicates(self, instance_ref, duplicated_instances):
        """
        Delete the duplicated instances with the same xml_hash and link their
        attachments to the reference instance (instance_ref).
        """
        duplicated_instance_ids = [i['id'] for i in duplicated_instances]

        if self._verbosity >= 1:
            self.stdout.write(
                f'Deleting instance #{duplicated_instance_ids} duplicates…'
            )

        with kc_transaction_atomic():
            # Update attachments
            Attachment.objects.select_for_update().filter(
                instance_id__in=duplicated_instance_ids
            ).update(instance_id=instance_ref['id'])
            if self._verbosity >= 2:
                self.stdout.write(
                    f"\tLinked attachments to instance #{instance_ref['id']}"
                )

            # Update Mongo
            parsed_instance = ParsedInstance.objects.select_related(
                'instance__xform__user', 'instance__user'
            ).get(instance_id=instance_ref['id'])
            parsed_instance.update_mongo(asynchronous=False, use_cached_parser=True)

        # Adjust counters and delete instances
        instance_queryset = Instance.objects.filter(
            id__in=duplicated_instance_ids
        ).values('xform_id', 'date_created__date', 'xform__user_id')

        with kc_transaction_atomic():
            for instance in instance_queryset:
                MonthlyXFormSubmissionCounter.objects.filter(
                    year=instance['date_created__date'].year,
                    month=instance['date_created__date'].month,
                    user_id=instance['xform__user_id'],
                    xform_id=instance['xform_id'],
                ).update(counter=F('counter') - 1)

                DailyXFormSubmissionCounter.objects.filter(
                    date=instance['date_created__date'],
                    xform_id=instance['xform_id'],
                ).update(counter=F('counter') - 1)

        xform = parsed_instance.instance.xform
        delete_instances(
            xform=xform,
            request_data={
                'submission_ids': duplicated_instance_ids,
                'query': '',
            },
        )

        if self._verbosity > 1:
            self.stdout.write(
                f'\tPurged instance IDs: {duplicated_instance_ids}'
            )

    def _filter_queryset(self, queryset, **options):

        username = options['user']
        xform_id_string = options['xform']

        if xform_id_string:
            if self._verbosity >= 3:
                self.stdout.write(f'Using option `--xform #{xform_id_string}`')
            queryset = queryset.filter(xform__id_string=xform_id_string)

        if username:
            if self._verbosity >= 3:
                self.stdout.write(f'Using option `--user #{username}`')
            queryset = queryset.filter(xform__user__username=username)

        return queryset

    def _get_duplicates_by_xml_hash(self, instances: QuerySet):
        """
        Extract duplicates with the same xml_hash and different xml_hash
        """
        same_xml_hash_duplicates, different_xml_hash_duplicates = [], []
        xml_hash_groups = defaultdict(list)

        # Group instances by their xml_hash
        for instance in instances.iterator():
            xml_hash_groups[instance['xml_hash']].append(instance)

        for xml_hash, duplicates in xml_hash_groups.items():
            if len(duplicates) > 1:
                same_xml_hash_duplicates.extend(duplicates)
            else:
                different_xml_hash_duplicates.extend(duplicates)

        return same_xml_hash_duplicates, different_xml_hash_duplicates

    def _replace_duplicates(self, duplicated_instances):
        """
        Update the UUID of instances with different xml_hash values.
        """
        idx = 0
        now = int(time.time())

        _cached_xform = None

        for duplicated_instance_batch in chunked(
            duplicated_instances, settings.LONG_RUNNING_MIGRATION_SMALL_BATCH_SIZE
        ):
            instances_to_update = []
            for duplicated_instance in duplicated_instance_batch:
                try:
                    instance = Instance.objects.get(pk=duplicated_instance['id'])
                except Instance.DoesNotExist:
                    continue

                if not _cached_xform:
                    _cached_xform = instance.xform
                else:
                    instance.xform = _cached_xform

                if self._verbosity >= 1:
                    self.stdout.write(f'\tUpdating instance #{instance.pk}…')

                # Update the UUID and XML hash
                old_uuid = instance.uuid
                instance.uuid = (
                    f'DUPLICATE-{now}-{idx}-{instance.xform.id_string}-'
                    f'{instance.uuid}'
                )
                if self._verbosity >= 2:
                    self.stdout.write(
                        f'\t\tOld UUID: {old_uuid}, New UUID: {instance.uuid}'
                    )
                instance.xml = set_meta(instance.xml, 'instanceID', instance.uuid)
                instance.xml_hash = instance.get_hash(instance.xml)
                instance._populate_root_uuid()  # noqa
                instances_to_update.append(instance)

                # Save the parsed instance to sync MongoDB
                try:
                    parsed_instance = instance.parsed_instance
                except Instance.parsed_instance.RelatedObjectDoesNotExist:
                    pass
                else:
                    parsed_instance.update_mongo(
                        asynchronous=False, use_cached_parser=True
                    )
                idx += 1

            if self._verbosity >= 3:
                self.stdout.write('\tUpdating batch…')
            Instance.objects.bulk_update(
                instances_to_update, ['uuid', 'xml', 'root_uuid', 'xml_hash']
            )
