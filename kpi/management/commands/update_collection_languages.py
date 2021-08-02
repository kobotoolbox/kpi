# -*- coding: utf-8 -*-
import sys

from django.core.management.base import BaseCommand

from kpi.constants import ASSET_TYPE_COLLECTION
from kpi.models.asset import Asset


class Command(BaseCommand):

    help = "Update collection languages by merging all their children's languages"

    def add_arguments(self, parser):
        super().add_arguments(parser)

        parser.add_argument(
            "--chunks",
            default=1000,
            type=int,
            help="Update only records by batch of `chunks`.",
        )

    def handle(self, *args, **options):

        chunks = options['chunks']

        query = Asset.objects.filter(asset_type=ASSET_TYPE_COLLECTION)
        total = query.count()
        max_pk = 0
        stop = False
        cpt = 0

        # TODO Since Django 2.x support server-side cursors by default,
        # update the code to use django native `.iterator(chunk_size)`
        while not stop:
            query = query.filter(pk__gt=max_pk).order_by('pk')
            if query.count() == 0:
                stop = True
            else:
                for collection in query.all()[:chunks]:
                    collection.update_languages()
                    cpt += 1
                    max_pk = collection.pk

                    progress = '\rUpdated {cpt}/{total} records...'.format(
                        cpt=cpt,
                        total=total
                    )
                    self.stdout.write(progress)
                    self.stdout.flush()

        self.stdout.write('Done!')
        self.stdout.flush()

