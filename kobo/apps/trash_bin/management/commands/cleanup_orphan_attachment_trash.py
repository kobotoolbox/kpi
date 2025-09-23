from django.core.management.base import BaseCommand
from django.db import transaction

from kobo.apps.openrosa.apps.logger.models import Attachment
from kobo.apps.trash_bin.models.attachment import AttachmentTrash


class Command(BaseCommand):

    help = (
        'Deletes attachment trash entries whose attachments are missing, '
        'and removes their associated periodic tasks.'
    )

    def handle(self, *args, **options):
        verbosity = options.get('verbosity', 1)

        att_trash_qs = AttachmentTrash.objects.select_related(
            'periodic_task'
        ).order_by('pk')

        deleted_count = 0
        for trash in att_trash_qs.iterator():
            try:
                attachment_exists = Attachment.all_objects.filter(
                    pk=trash.attachment_id
                ).exists()
                if attachment_exists:
                    continue

                if verbosity > 1:
                    self.stdout.write(
                        f'Deleting orphan AttachmentTrash ID {trash.pk} '
                        f'(attachment_id={trash.attachment_id})'
                    )

                with transaction.atomic():
                    periodic_task = trash.periodic_task
                    trash.delete()
                    if periodic_task:
                        if verbosity > 1:
                            self.stdout.write(
                                f'Removing periodic task ID {periodic_task.pk}'
                            )
                        periodic_task.delete()
                    deleted_count += 1
            except Exception as e:
                self.stdout.write(f'Error deleting trash ID {trash.pk}: {e}')

        self.stdout.write(
            f'Deleted {deleted_count} orphan AttachmentTrash entries.'
        )
