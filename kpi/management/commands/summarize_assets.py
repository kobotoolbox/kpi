# coding: utf-8
from django.core.management.base import BaseCommand

from kpi.models import Asset


def _set_auto_field_update(kls, field_name, val):
    field = [f for f in kls._meta.fields if f.name == field_name][0]
    field.auto_now = val
    field.auto_now_add = val


class Command(BaseCommand):
    def handle(self, *args, **options):
        _set_auto_field_update(Asset, 'date_modified', False)
        assets = Asset.objects.all()
        for asset in assets:
            asset.save()
        _set_auto_field_update(Asset, 'date_modified', True)
