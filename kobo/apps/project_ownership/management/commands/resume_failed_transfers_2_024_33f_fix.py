from django.core.management.base import BaseCommand

from ...models import (
    Transfer,
    TransferStatus,
    TransferStatusChoices,
    TransferStatusTypeChoices,
)
from ...utils import move_attachments


class Command(BaseCommand):
    help = (
        'Resume project ownership transfers done under `2.024.33f` (and later) '
        'which failed with error: "Model.save() got an unexpected keyword argument'
        ' \'updated_fields\'"'
    )

    def handle(self, *args, **options):

        verbosity = options['verbosity']

        for transfer_status in TransferStatus.objects.filter(
            status=TransferStatusChoices.FAILED,
            status_type=TransferStatusTypeChoices.ATTACHMENTS,
            error__icontains="got an unexpected keyword argument 'updated_fields'",
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
                self.stdout.write(f'Resuming `{transfer.asset}` transfer…')

            # We do not want any error to break the management command,
            # so we catch any exception and log it for later purpose.
            try:
                if verbosity:
                    self.stdout.write('\tMoving attachments…')
                move_attachments(transfer)
            except Exception as e:
                self.stderr.write(f'Failed to move attachments: {e}')
                TransferStatus.objects.filter(
                    transfer=transfer,
                    status_type=TransferStatusTypeChoices.ATTACHMENTS,
                ).update(error=str(e), status=TransferStatusChoices.FAILED)

            if verbosity:
                self.stdout.write('\tDone!')

    def _validate_whether_transfer_can_be_fixed(self, transfer: Transfer) -> bool:
        original_new_owner_id = transfer.invite.recipient_id
        current_owner_id = transfer.asset.owner_id

        return current_owner_id == original_new_owner_id
