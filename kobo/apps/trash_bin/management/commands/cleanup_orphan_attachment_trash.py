from django.core.management.base import BaseCommand
from django.db import transaction
from django_celery_beat.models import PeriodicTask

from kobo.apps.openrosa.apps.logger.models import Attachment
from kobo.apps.trash_bin.models.attachment import AttachmentTrash


class Command(BaseCommand):

    help = (
        'Deletes attachment trash entries whose attachments are missing, '
        'and removes their associated periodic tasks.'
    )

    def handle(self, *args, **options):
        verbosity = options.get('verbosity', 1)
        chunk_size = 1000

        deleted_count = 0
        qs = AttachmentTrash.objects.select_related('periodic_task').order_by('pk')

        batch = []
        for trash in qs.iterator(chunk_size=chunk_size):
            batch.append(trash)
            if len(batch) >= chunk_size:
                deleted_count += self._process_batch(batch, verbosity)
                batch = []

        # Process leftovers
        if batch:
            deleted_count += self._process_batch(batch, verbosity)

        self.stdout.write(f'Deleted {deleted_count} orphan AttachmentTrash entries.')

    def _process_batch(self, batch, verbosity):
        """
        Check a batch of AttachmentTrash rows against existing Attachments,
        delete orphans in bulk
        """
        attachment_ids = [t.attachment_id for t in batch]

        existing_ids = set(
            Attachment.all_objects.filter(
                pk__in=attachment_ids, delete_status='pending'
            ).values_list('pk', flat=True)
        )

        # Get AttachmentTrash objs whose attachments are missing
        orphans = [t for t in batch if t.attachment_id not in existing_ids]
        if not orphans:
            return 0

        orphan_ids = [t.pk for t in orphans]
        periodic_task_ids = [t.periodic_task_id for t in orphans if t.periodic_task_id]

        with transaction.atomic():
            AttachmentTrash.objects.filter(pk__in=orphan_ids).delete()
            if periodic_task_ids:
                PeriodicTask.objects.filter(pk__in=periodic_task_ids).delete()

        if verbosity > 1:
            self.stdout.write(
                f'Deleted {len(orphan_ids)} orphan AttachmentTrash '
                f'and {len(periodic_task_ids)} periodic tasks in this batch.'
            )

        return len(orphan_ids)
