#!/usr/bin/env python
# vim: ai ts=4 sts=4 et sw=4 fileencoding=utf-8
# coding: utf-8
from collections import defaultdict

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import F
from django.db.models.aggregates import Count

from kobo.apps.openrosa.apps.logger.models import (
    DailyXFormSubmissionCounter,
    MonthlyXFormSubmissionCounter
)
from kobo.apps.openrosa.apps.logger.models.attachment import Attachment
from kobo.apps.openrosa.apps.logger.models.instance import Instance
from kobo.apps.openrosa.apps.viewer.models.parsed_instance import ParsedInstance
from kobo.apps.openrosa.apps.logger.xform_instance_parser import set_meta


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
            "--user",
            default=None,
            help="Specify a username to clean up only their forms",
        )

        parser.add_argument(
            "--xform",
            default=None,
            help="Specify a XForm's `id_string` to clean up only this form",
        )

    def handle(self, *args, **options):
        username = options['user']
        xform_id_string = options['xform']
        self._verbosity = options['verbosity']

        # Retrieve all instances with the same `uuid`
        query = Instance.objects
        if xform_id_string:
            query = query.filter(xform__id_string=xform_id_string)

        if username:
            query = query.filter(xform__user__username=username)

        query = (
            query.values_list('uuid', flat=True)
            .annotate(count_uuid=Count('uuid'))
            .filter(count_uuid__gt=1)
            .distinct()
        )

        for uuid in query.iterator():
            # Get all instances with the same UUID
            duplicates_queryset = Instance.objects.filter(uuid=uuid)

            instances = duplicates_queryset.values(
                'id', 'uuid', 'xml_hash', 'xform_id', 'date_created'
            ).order_by('xform_id', 'uuid', 'date_created')

            # Separate duplicates by their xml_hash (same and different)
            same_xml_hash_duplicates, different_xml_hash_duplicates = (
                self._get_duplicates_by_xml_hash(instances)
            )

            # Handle the same xml_hash duplicates
            if same_xml_hash_duplicates:
                instance_ref = same_xml_hash_duplicates.pop(0)
                self._delete_duplicates(
                    instance_ref, same_xml_hash_duplicates
                )

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

        with transaction.atomic():
            # Update attachments
            Attachment.objects.select_for_update().filter(
                instance_id__in=duplicated_instance_ids
            ).update(instance_id=instance_ref['id'])
            if self._verbosity >= 2:
                self.stdout.write(
                    f"\tLinked attachments to instance #{instance_ref['id']}"
                )

            # Update Mongo
            main_instance = Instance.objects.get(id=instance_ref['id'])
            main_instance.parsed_instance.save()

            # Delete duplicated ParsedInstances
            ParsedInstance.objects.filter(
                instance_id__in=duplicated_instance_ids
            ).delete()

            # Adjust counters and delete instances
            instance_queryset = Instance.objects.filter(
                id__in=duplicated_instance_ids
            )
            for instance in instance_queryset.values(
                'xform_id', 'date_created__date', 'xform__user_id'
            ):
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

            instance_queryset.delete()

            settings.MONGO_DB.instances.delete_many(
                {'_id': {'$in': duplicated_instance_ids}}
            )
            if self._verbosity > 1:
                self.stdout.write(
                    f'\tPurged instance IDs: {duplicated_instance_ids}'
                )

    def _replace_duplicates(self, duplicated_instances):
        """
        Update the UUID of instances with different xml_hash values.
        """
        instances_to_update = []
        for idx, duplicated_instance in enumerate(duplicated_instances):
            try:
                instance = Instance.objects.get(pk=duplicated_instance['id'])
            except Instance.DoesNotExist:
                continue

            if self._verbosity >= 1:
                self.stdout.write(
                    f'\tUpdating instance #{instance.pk}…'
                )

            # Update the UUID and XML hash
            old_uuid = instance.uuid
            instance.uuid = (
                f'DUPLICATE-{idx}-{instance.xform.id_string}-'
                f'{instance.uuid}'
            )
            if self._verbosity >= 2:
                self.stdout.write(
                    f'\t\tOld UUID: {old_uuid}, New UUID: {instance.uuid}'
                )
            instance.xml = set_meta(
                instance.xml, 'instanceID', instance.uuid
            )
            instance.xml_hash = instance.get_hash(instance.xml)
            instances_to_update.append(instance)

            # Save the parsed instance to sync MongoDB
            parsed_instance = instance.parsed_instance
            parsed_instance.save()

        Instance.objects.bulk_update(
            instances_to_update, ['uuid', 'xml', 'xml_hash']
        )

    def _get_duplicates_by_xml_hash(self, instances):
        """
        Extract duplicates with the same xml_hash and different xml_hash
        """
        same_xml_hash_duplicates, different_xml_hash_duplicates = [], []
        xml_hash_groups = defaultdict(list)

        # Group instances by their xml_hash
        for instance in instances:
            xml_hash_groups[instance['xml_hash']].append(instance)

        for xml_hash, duplicates in xml_hash_groups.items():
            if len(duplicates) > 1:
                same_xml_hash_duplicates.extend(duplicates)
            else:
                different_xml_hash_duplicates.extend(duplicates)

        return same_xml_hash_duplicates, different_xml_hash_duplicates
