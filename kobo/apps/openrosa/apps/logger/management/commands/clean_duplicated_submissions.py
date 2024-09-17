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

    help = "Deletes duplicated submissions (i.e same `uuid` and same `xml`)"

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

        parser.add_argument(
            '--delete-unique-uuids',
            action='store_true',
            default=False,
            help='Delete duplicates with identical uuid',
        )

    def handle(self, *args, **options):
        username = options['user']
        xform_id_string = options['xform']
        self._delete_unique_uuids = options['delete_unique_uuids']
        self._verbosity = options['verbosity']

        # Retrieve all instances with the same `xml_hash`.
        query = Instance.objects
        if xform_id_string:
            query = query.filter(xform__id_string=xform_id_string)

        if username:
            query = query.filter(xform__user__username=username)

        query = (
            query.values_list('xml_hash', flat=True)
            .annotate(count_xml_hash=Count('xml_hash'))
            .filter(count_xml_hash__gt=1)
            .distinct()
        )

        for xml_hash in query.iterator():

            duplicates_queryset = Instance.objects.filter(xml_hash=xml_hash)

            instances_with_same_xml_hash = duplicates_queryset.values(
                'id', 'uuid', 'xform_id'
            ).order_by('xform_id', 'uuid', 'date_created')

            duplicates_by_xform = self._get_duplicates_by_xform(
                instances_with_same_xml_hash
            )

            for (
                xform_id,
                instances_with_same_xml_hash,
            ) in duplicates_by_xform.items():
                instance_ref = instances_with_same_xml_hash.pop(0)
                self._clean_up(instance_ref, instances_with_same_xml_hash)

    def _clean_up(self, instance_ref, duplicated_instances):

        if duplicated_instances:

            if self._replace_duplicates(duplicated_instances):
                return

            self._delete_duplicates(instance_ref, duplicated_instances)

    def _delete_duplicates(
        self, instance_ref: dict, duplicated_instances: list[dict]
    ):

        duplicated_instance_ids = [i['id'] for i in duplicated_instances]

        if self._verbosity >= 1:
            self.stdout.write(
                f"Deleting instance #{instance_ref['id']} duplicates…"
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
            main_instance = Instance.objects.get(
                id=instance_ref['id']
            )
            main_instance.parsed_instance.save()

            ParsedInstance.objects.filter(
                instance_id__in=duplicated_instance_ids
            ).delete()

            instance_queryset = Instance.objects.filter(
                id__in=duplicated_instance_ids
            )
            # update counters
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

    def _replace_duplicates(self, duplicated_instances: list) -> bool:
        uniq__uuids = set([i['uuid'] for i in duplicated_instances])

        if len(uniq__uuids) > 1 or self._delete_unique_uuids:
            return False

        duplicates = []

        for idx, duplicated_instance in enumerate(duplicated_instances):
            try:
                instance = Instance.objects.get(pk=duplicated_instance['id'])
            except Instance.DoesNotExist:
                pass
            else:
                if self._verbosity > 1:
                    self.stdout.write(
                        f'\tUpdating instance #{instance.pk} ({instance.uuid})…'
                    )

                instance.uuid = f'DUPLICATE {idx} {instance.uuid}'
                instance.xml = set_meta(
                    instance.xml, 'instanceID', instance.uuid
                )
                instance.xml_hash = instance.get_hash(instance.xml)
                duplicates.append(instance)

        if duplicates:
            Instance.objects.bulk_update(
                duplicates, fields=['uuid', 'xml', 'xml_hash']
            )

        return True

    def _get_duplicates_by_xform(self, queryset):
        duplicates_by_xform = defaultdict(list)
        for record in queryset:
            duplicates_by_xform[record['xform_id']].append(record)

        return duplicates_by_xform
