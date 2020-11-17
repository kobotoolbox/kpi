# coding: utf-8
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from kpi.constants import ASSET_TYPE_COLLECTION
from kpi.utils.sheet_converter import convert_xls_to_ss_structure


class Command(BaseCommand):

    def handle(self, *args, **options):
        username = args[0]
        filename = args[1]
        user = User.objects.get(username=username)
        with open(filename, 'rb') as ff:
            contents = convert_xls_to_ss_structure(ff)
        library = contents.get('library')
        choices = contents.get('choices')
        columns = library[0]
        rows = []
        for row in library[1:]:
            rows.append(dict(zip(columns, row)))
        collections = user.collections.filter(name=filename)
        for collection in collections:
            collection.delete()
        assets = []
        for row in rows:
            assets.append({
                    'name': 'imported asset',
                    'content': {
                        'choices': choices,
                        'survey': [row],
                    },
                })
        new_library = user.assets.create(
            asset_type=ASSET_TYPE_COLLECTION, name=filename,
            children_to_create=assets
        )
