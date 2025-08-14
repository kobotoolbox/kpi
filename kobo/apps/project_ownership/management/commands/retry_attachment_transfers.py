from django.core.management.base import BaseCommand

from kpi.utils.log import logging
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

    def add_arguments(self, parser):
        parser.add_argument('transfer_uids', nargs='+', type=str)

    def handle(self, *args, **options):
        for transfer_uid in options.get('transfer_uids', []):
            if not TransferStatus.objects.filter(
                transfer__uid=transfer_uid,
                status_type=TransferStatusTypeChoices.ATTACHMENTS,
                status=TransferStatusChoices.FAILED,
            ).exists():
                logging.warn(
                    f'No failed attachment transfers for {transfer_uid}. Will not continue.'
                )
                continue
            transfer = Transfer.objects.get(uid=transfer_uid)
            move_attachments(transfer)
