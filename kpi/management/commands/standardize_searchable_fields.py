from django.core.management.base import BaseCommand

from hub.models import ExtraUserDetail
from kpi.models.asset import Asset
from kpi.constants import ASSET_TYPE_COLLECTION, ASSET_TYPE_SURVEY


class Command(BaseCommand):

    help = "Standardize fields for search with query parser"

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
        self.standardize_assets()
        self.standardize_extra_user_details()

    def standardize_assets(self):
        assets = Asset.all_objects.only(
            'asset_type', 'uid', 'settings', 'summary'
        )
        self.stdout.write(f'Updating assets...')
        for asset in assets.iterator(chunk_size=self._chunks):
            if self._verbosity >= 1:
                self.stdout.write(f'\tAsset {asset.uid}...')

            if asset.asset_type in [ASSET_TYPE_COLLECTION, ASSET_TYPE_SURVEY]:
                asset.standardize_json_field('settings', 'country', list)
                asset.standardize_json_field(
                    'settings',
                    'country_codes',
                    list,
                    [c['value'] for c in asset.settings['country']],
                    force_default=True
                )
                asset.standardize_json_field('settings', 'sector', dict)
                asset.standardize_json_field('settings', 'description', str)
                asset.standardize_json_field('settings', 'organization', str)

            # No need to call `Asset._populate_summary` since `asset` is not
            # a new one.
            asset.standardize_json_field('summary', 'languages', list)
            Asset.all_objects.filter(pk=asset.pk).update(
                settings=asset.settings,
                summary=asset.summary
            )

        if self._verbosity >= 1:
            self.stdout.write(f'Done!')

    def standardize_extra_user_details(self):
        extra_user_details = (
            ExtraUserDetail.objects.only('data').prefetch_related('user')
        )
        self.stdout.write(f'Updating users’ extra details...')
        for extra_user_detail in extra_user_details.iterator(
            chunk_size=self._chunks
        ):
            if self._verbosity >= 1:
                self.stdout.write(f'\tUser {extra_user_detail.user.username}...')
            extra_user_detail.save(update_fields=['data'])
        if self._verbosity >= 1:
            self.stdout.write(f'Done!')
