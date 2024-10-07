from django.core.management import call_command
from django.core.management.base import BaseCommand

from ...models import (
    Transfer,
    TransferStatus,
    TransferStatusChoices,
    TransferStatusTypeChoices,
)
from ...utils import (
    move_media_files,
    move_attachments,
    rewrite_mongo_userform_id,
)


class Command(BaseCommand):
    help = (
        'Resume project ownership transfers done under `2.024.25` which failed '
        'with error: "Project A : previous_owner -> new_owner is not in progress"'
    )

    def handle(self, *args, **options):

        usernames = set()
        verbosity = options['verbosity']

        for transfer_status in TransferStatus.objects.filter(
            status=TransferStatusChoices.FAILED,
            status_type=TransferStatusTypeChoices.GLOBAL,
            error__icontains='is not in progress',
        ).iterator():
            transfer = transfer_status.transfer
            if transfer.asset.pending_delete:
                if verbosity:
                    self.stdout.write(
                        f'Project `{transfer.asset}` is in trash bin, skip it!'
                    )
                continue

            if not self._validate_whether_transfer_can_be_fixed(transfer):
                if verbosity:
                    self.stdout.write(
                        f'Project `{transfer.asset}` transfer cannot be fixed'
                        f' automatically'
                    )
                continue

            if not transfer.asset.has_deployment:
                continue

            if verbosity:
                self.stdout.write(
                    f'Resuming `{transfer.asset}` transfer…'
                )
            self._move_data(transfer)
            move_attachments(transfer)
            move_media_files(transfer)
            if verbosity:
                self.stdout.write('\tDone!')
            usernames.add(transfer.invite.recipient.username)

        # Update attachment storage bytes counters
        for username in usernames:
            call_command(
                'update_attachment_storage_bytes',
                verbosity=verbosity,
                force=True,
                username=username,
            )

    def _move_data(self, transfer: Transfer):

        # Sanity check
        asset = transfer.asset
        rewrite_mongo_userform_id(transfer)
        number_of_submissions = asset.deployment.xform.num_of_submissions
        submission_ids = [
            s['_id']
            for s in asset.deployment.get_submissions(asset.owner, fields=['_id'])
        ]

        if number_of_submissions == (mongo_document_count := len(submission_ids)):
            self.stdout.write(f'\tSuccess: {number_of_submissions} submissions moved!')
        else:
            missing_count = number_of_submissions - mongo_document_count
            self.stdout.write(
                f'\t⚠️ Only {mongo_document_count} submissions moved, '
                f'{missing_count} are missing!'
            )

    def _validate_whether_transfer_can_be_fixed(self, transfer: Transfer) -> bool:
        original_new_owner_id = transfer.invite.recipient_id
        current_owner_id = transfer.asset.owner_id

        return current_owner_id == original_new_owner_id