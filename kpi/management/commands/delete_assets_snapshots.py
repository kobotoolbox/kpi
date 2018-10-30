# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from datetime import timedelta
import sys

from django.core.management.base import BaseCommand
from django.db import transaction, connection
from django.db.models import Max
from django.utils import timezone

from kpi.models import AssetSnapshot
import time

class Command(BaseCommand):

    help = "Deletes assets snapshots"

    def add_arguments(self, parser):
        super(Command, self).add_arguments(parser)
        parser.add_argument(
            "--days",
            default=90,
            type=int,
            help="Delete only import tasks older than the specified number of days. Default: 90",
        )

        parser.add_argument(
            "--chunks",
            default=1000,
            type=int,
            help="Delete only import tasks by batch of `chunks` records. Default: 1000",
        )

        parser.add_argument(
            "--vacuum",
            action='store_true',
            default=False,
            help="Run `VACUUM` on tables after deletion",
        )

        parser.add_argument(
            "--vacuum-full",
            action='store_true',
            default=False,
            help="Run `VACUUM FULL` instead of `VACUUM`.",
        )

    def handle(self, *args, **options):
        days = options["days"]
        chunks = options["chunks"]
        verbosity = options["verbosity"]
        vacuum_full = options["vacuum_full"]
        vacuum = options["vacuum"]


        # Retrieve Snapshots linked to assets' latest versions.
        # Use iterator to by-pass Django QuerySet caching.
        latest_versions_ids = [version[1] for version in AssetSnapshot.objects.values_list("asset_id").\
            annotate(latest_version_id=Max("asset_version_id")).iterator()]

        latest_versions_ids = list(set(latest_versions_ids))
        if None in latest_versions_ids:
            latest_versions_ids.remove(None)

        snapshots_to_delete = AssetSnapshot.objects.filter(
            date_created__lt=timezone.now() - timedelta(days=days),
        ).exclude(asset_version_id__in=latest_versions_ids)

        chunked_delete_ids = []
        chunks_cpt = 1
        total = snapshots_to_delete.count()

        for snapshot_id in snapshots_to_delete.values_list("id", flat=True).iterator():

            chunked_delete_ids.append(snapshot_id)

            if (chunks_cpt % chunks) == 0 or chunks_cpt == total:
                with transaction.atomic():  # Wrap into a transaction because of CASCADE, post_delete signals
                    chuncked_objects_to_delete = AssetSnapshot.objects.filter(id__in=chunked_delete_ids)
                    if verbosity >= 1:
                        progress = "\rDeleting {chunk}/{total} assets snapshots...".format(
                            chunk=chunks_cpt,
                            total=total
                        )
                        sys.stdout.write(progress)
                        sys.stdout.flush()
                    chuncked_objects_to_delete.delete()
                chunked_delete_ids = []

            chunks_cpt += 1

        print("")

        if vacuum is True or vacuum_full is True:
            self.do_vacuum(vacuum_full)

        print("Done!")

    def do_vacuum(self, full=False):
        cursor = connection.cursor()
        if full:
            print("Vacuuming (full) table {}...".format(AssetSnapshot._meta.db_table))
            cursor.execute("VACUUM FULL {}".format(AssetSnapshot._meta.db_table))
        else:
            print("Vacuuming table {}...".format(AssetSnapshot._meta.db_table))
            cursor.execute("VACUUM {}".format(AssetSnapshot._meta.db_table))
        connection.commit()
