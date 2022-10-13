# coding: utf-8
from django.core.management.base import BaseCommand

from kpi.models import Asset, AssetMetadata


class Command(BaseCommand):
    def handle(self, *args, **options):
        for asset in Asset.objects.all():
            if not AssetMetadata.objects.filter(asset=asset):
                AssetMetadata.objects.create(
                    asset=asset, settings=asset.settings
                )
