from django.core.management.base import BaseCommand, CommandError
from kpi.models import Asset

def _set_auto_field_update(kls, field_name, val):
    field = filter(lambda f: f.name == field_name, kls._meta.fields)[0]
    field.auto_now = val
    field.auto_now_add = val

class Command(BaseCommand):
    def handle(self, *args, **options):
        _set_auto_field_update(Asset, 'date_modified', False)
        assets = Asset.objects.all()
        for asset in assets:
            asset.save()
        _set_auto_field_update(Asset, 'date_modified', True)
