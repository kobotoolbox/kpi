from django.core.management.base import BaseCommand
from django.core.paginator import Paginator
from django.db.models import Prefetch

from kpi.models.asset import Asset, AssetVersion
from kpi.constants import ASSET_TYPE_SURVEY


class Command(BaseCommand):

    help = "Populate `date_deployed` from latest deployed asset's version"

    def add_arguments(self, parser):
        super().add_arguments(parser)

        parser.add_argument(
            "--chunks",
            default=2000,
            type=int,
            help="Update only records by batch of `chunks`.",
        )

    def handle(self, *args, **options):

        self._verbosity = options['verbosity']
        self._chunks = options['chunks']
        self.populate_date_deployed()

    def populate_date_deployed(self):
        queryset = (
            Asset.all_objects.only('uid', 'date_deployed')
            .filter(asset_type=ASSET_TYPE_SURVEY)
            .prefetch_related(
                Prefetch(
                    'asset_versions',
                    queryset=AssetVersion.objects.order_by('date_modified')
                    .only('uid', 'asset', 'date_modified', 'deployed')
                    .filter(deployed=True),
                    to_attr='prefetched_deployed_versions',
                ),
            )
        )

        paginator = Paginator(queryset, self._chunks)

        self.stdout.write(f'Updating assets...')

        for page in paginator.page_range:
            assets = paginator.page(page).object_list
            for asset in assets:
                if self._verbosity >= 1:
                    self.stdout.write(f'\tAsset {asset.uid}...')

                try:
                    first_deployed_version = asset.prefetched_deployed_versions[0]
                except IndexError:
                    pass
                else:
                    asset.date_deployed = first_deployed_version.date_modified

            Asset.all_objects.bulk_update(assets, fields=['date_deployed'])
