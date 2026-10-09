from __future__ import annotations

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db.models import Q

from kobo.apps.openrosa.apps.logger.models import (
    Attachment,
    Instance,
    XForm,
)


class Command(BaseCommand):

    help = (
        'Undelete background audio files and audit logs previously soft-deleted'
        ' by a bug introduced in release 2.023.37c'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--chunks',
            type=int,
            default=2000,
            help='Number of records to process per query'
        )

        parser.add_argument(
            '--force',
            action='store_true',
            default=False,
            help='Run the management command even if no attachments are affected'
        )

    def handle(self, *args, **kwargs):
        chunks = kwargs['chunks']
        verbosity = kwargs['verbosity']
        force = kwargs['force']

        self.stdout.write(
            '⚠ Warning! This management can take a while (i.e. several hours) '
            'to run on big databases'
        )

        queryset = Attachment.all_objects.filter(
            Q(media_file_basename='audit.csv')
            | Q(media_file_basename__endswith='.enc')
            | Q(media_file_basename__regex=r'^\d{10,}\.(m4a|amr)$'),
            deleted_at__isnull=False,
        )

        if not queryset.exists() and not force:
            self.stdout.write(
                'No background recording or audit logs seem to be affected'
            )
            return

        att_queryset = Attachment.all_objects.filter(
            Q(media_file_basename='audit.csv')
            | Q(media_file_basename__endswith='.enc')
            | Q(media_file_basename__regex=r'^\d{10,}\.(m4a|amr)$')
        )
        if not force:
            att_queryset = att_queryset.filter(deleted_at__isnull=False)

        instance_ids = list(
            att_queryset.values_list('instance_id', flat=True).distinct()
        )

        if verbosity > 1:
            instances_count = len(instance_ids)
            self.stdout.write(f'Instances to process: {instances_count}…')

        cpt = 1

        instances = Instance.objects.filter(pk__in=instance_ids).order_by('id')
        for instance in instances.iterator(chunk_size=chunks):
            message = '' if verbosity <= 1 else f' - {cpt}/{instances_count}'
            if verbosity:
                self.stdout.write(
                    f'Processing instance #{instance.pk}{message}…'
                )
            Attachment.all_objects.filter(
                Q(media_file_basename='audit.csv')
                | Q(media_file_basename__endswith='.enc')
                | Q(media_file_basename__regex=r'^\d+\.(m4a|amr)$'),
                instance_id=instance.pk,
            ).update(deleted_at=None)
            try:
                instance.parsed_instance.update_mongo()
            except Instance.parsed_instance.RelatedObjectDoesNotExist:
                pass
            cpt += 1

        if verbosity:
            self.stdout.write(
                f'Updating storage counters…'
            )
        # Recount the storage of the owners of the affected projects
        xform_ids = (
            Instance.objects.filter(pk__in=instance_ids)
            .values_list('xform_id', flat=True)
            .distinct()
        )
        usernames = (
            XForm.all_objects.filter(pk__in=list(xform_ids))
            .values_list('user__username', flat=True)
            .distinct()
        )
        for username in usernames:
            call_command(
                'update_attachment_storage_bytes',
                verbosity=verbosity,
                force=True,
                username=username,
            )

        self.stdout.write('Done!')
