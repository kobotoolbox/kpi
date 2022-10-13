# coding: utf-8
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from kpi.models import Asset, AssetMetadata


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            '-u',
            action='store',
            dest='username',
            default=False,
            help="Migrate only a specific user's assets",
        )
        parser.add_argument(
            '--sync',
            '-s',
            action='store_true',
            dest='sync',
            default=False,
            help='Sync Asset.settings with AssetMetadata.settings',
        )

    def handle(self, *args, **options):
        username = options.get('username')
        if username is not None:
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                user = None

        assets = Asset.objects.all()
        if user is not None:
            assets = assets.filter(owner=user)

        sync = options.get('sync', False)
        for asset in assets:
            ams = AssetMetadata.objects.filter(asset=asset)
            if not ams:
                AssetMetadata.objects.create(
                    asset=asset, settings=asset.settings
                )
            if sync and ams:
                am = ams.first()
                am.settings.update(asset.settings)
                am.save()
