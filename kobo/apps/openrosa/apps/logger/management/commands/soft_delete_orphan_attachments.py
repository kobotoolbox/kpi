from __future__ import annotations

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import F

from kobo.apps.openrosa.apps.logger.models import (
    Attachment,
    Instance,
)
from kobo.apps.openrosa.apps.logger.signals import pre_delete_attachment
from kobo.apps.openrosa.libs.utils.logger_tools import get_soft_deleted_attachments


class Command(BaseCommand):

    help = "Soft delete orphan attachments, i.e: Hide them in API responses"

    def add_arguments(self, parser):
        parser.add_argument(
            '--chunks',
            type=int,
            default=2000,
            help='Number of records to process per query'
        )

        parser.add_argument(
            '--start-id',
            type=int,
            default=0,
            help='Instance ID to start from'
        )

        parser.add_argument(
            '--start-date',
            type=str,
            default=None,
            help='Starting date to start from. Format: yyyy-mm-aa.'
        )

        parser.add_argument(
            '--not-edited-offset',
            type=int,
            default=10,
            help=(
                'Offset in seconds between creation date and modification date '
                'to consider submissions as not edited'
            )
        )

    def handle(self, *args, **kwargs):
        chunks = kwargs['chunks']
        verbosity = kwargs['verbosity']
        start_id = kwargs['start_id']
        start_date = kwargs['start_date']
        offset = kwargs['not_edited_offset']

        self.stdout.write(
            '⚠ Warning! This management can take a while (i.e. several days) '
            'to run on big databases'
        )

        instance_ids = Attachment.objects.values_list(
            'instance_id', flat=True
        ).distinct()

        if start_id:
            instance_ids = instance_ids.filter(instance_id__gte=start_id)

        queryset = (
            Instance.objects.only('xml', 'xform')
            .filter(pk__in=instance_ids)
            .exclude(
                date_modified__lt=F('date_created')
                + timedelta(seconds=offset),
            )
        )

        if start_id:
            queryset = queryset.filter(pk__gte=start_id)

        if start_date:
            queryset = queryset.filter(date_created__date__gte=start_date)

        if verbosity > 1:
            self.stdout.write(
                f'Calculating number of Instance objects with attachments…'
            )
            instances_count = queryset.count()

        cpt = 1
        queryset = queryset.order_by('pk')

        if verbosity > 1:
            self.stdout.write(
                f'Retrieving Instance objects…'
            )

        for instance in queryset.iterator(chunk_size=chunks):
            if verbosity > 0:
                message = '' if verbosity <= 1 else f' - {cpt}/{instances_count}'
                self.stdout.write(
                    f'Processing Instance object #{instance.pk}{message}…'
                )

            try:
                soft_deleted_attachments = get_soft_deleted_attachments(instance)
            except Exception as e:
                cpt += 1
                if verbosity > 0:
                    self.stderr.write(f'\tError: {str(e)}')
                continue

            for soft_deleted_attachment in soft_deleted_attachments:
                # Avoid fetching Instance object once again
                soft_deleted_attachment.instance = instance
                pre_delete_attachment(
                    soft_deleted_attachment, only_update_counters=True
                )
            if verbosity > 1:
                message = '' if verbosity <= 1 else f' - {cpt}/{instances_count}'
                self.stdout.write(
                    f'\tInstance object #{instance.pk}{message} updated!'
                )
            cpt += 1

        self.stdout.write('Done!')
