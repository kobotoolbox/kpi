from django.core.management.base import BaseCommand

from hub.models import ExtraUserDetail
from kpi.models.asset import Asset


class Command(BaseCommand):

    help = "Standardize fields for search with query parser"

    def handle(self, *args, **options):

        self._verbosity = options['verbosity']
        self.standardize_assets()
        self.standardize_extra_user_details()

    def standardize_assets(self):
        assets = Asset.objects.only('settings', 'summary').all()
        self.stdout.write(f'Updating assets...')
        for asset in assets:
            if self._verbosity >= 1:
                self.stdout.write(f'\tAsset {asset.uid}...')
            asset.save(
                update_fields=['settings', 'summary'],
                create_version=False,
                adjust_content=False,
            )
        if self._verbosity >= 1:
            self.stdout.write(f'Done!')

    def standardize_extra_user_details(self):
        extra_user_details = (
            ExtraUserDetail.objects.only('data').prefetch_related('user').all()
        )
        self.stdout.write(f'Updating users’ extra details...')
        for extra_user_detail in extra_user_details:
            if self._verbosity >= 1:
                self.stdout.write(f'\tUser {extra_user_detail.user.username}...')
            extra_user_detail.save(update_fields=['data'])
        if self._verbosity >= 1:
            self.stdout.write(f'Done!')
