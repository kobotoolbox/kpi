# coding: utf-8
from django.core.management.base import BaseCommand

from kpi.models import Asset
from kpi.utils.models import _set_auto_field_update


class Command(BaseCommand):
    def handle(self, *args, **options):
        _set_auto_field_update(Asset, 'date_modified', False)
        assets = Asset.objects.all()
        for asset in assets:
            asset.save()
        _set_auto_field_update(Asset, 'date_modified', True)
