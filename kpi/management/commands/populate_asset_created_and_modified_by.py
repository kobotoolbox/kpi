from django.core.management.base import BaseCommand
from django.core.paginator import Paginator
from django.db.models import Q, Prefetch

from kobo.apps.project_ownership.models import Transfer
from kpi.models.asset import Asset

class Command(BaseCommand):

    help = 'Populate `created_by` and `last_modified_by` fields for assets'

    def add_arguments(self, parser):
        super().add_arguments(parser)

        parser.add_argument(
            '--chunks',
            default=2000,
            type=int,
            help='Update only records by batch of `chunks`.',
        )

    def handle(self, *args, **options):
        self._verbosity = options['verbosity']
        self._chunks = options['chunks']
        self.populate_created_by_and_last_modified_by()

    def populate_created_by_and_last_modified_by(self):
        queryset = (
            Asset.all_objects.only(
                'uid', 'owner_id', 'created_by', 'last_modified_by'
            )
            .filter(Q(created_by__isnull=True) | Q(last_modified_by__isnull=True))
            .prefetch_related(
                Prefetch(
                    'transfers',
                    queryset=Transfer.objects.order_by(
                        'date_created'
                    ).select_related('invite__sender'),
                    to_attr='prefetched_transfers',
                )
            )
        )

        paginator = Paginator(queryset, self._chunks)

        self.stdout.write(f'Updating assets...')

        for page in paginator.page_range:
            assets = paginator.page(page).object_list

            for asset in assets:
                if self._verbosity >= 1:
                    self.stdout.write(f'\tAsset {asset.uid}...')

                # Set created_by based on the first transfer's invite sender or
                # fallback to the owner
                transfers = asset.prefetched_transfers
                owner = asset.owner
                if transfers and transfers[0].invite:
                    first_transfer = transfers[0]
                    asset.created_by = first_transfer.invite.sender.username
                elif owner:
                    asset.created_by = owner.username
                else:
                    # Handle case where asset.owner is None, which is allowed
                    # due to null=True constraint. If this constraint is removed
                    # in the future, this null handling can be removed
                    asset.created_by = None

                # Default the last_modified_by to the owner's username
                asset.last_modified_by = owner.username if owner else None

            Asset.all_objects.bulk_update(
                assets,
                fields=['created_by', 'last_modified_by']
            )

        self.stdout.write('Assets updated successfully.')
