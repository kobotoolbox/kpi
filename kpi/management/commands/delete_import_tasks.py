# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from datetime import timedelta
import sys

from django.core.management.base import BaseCommand
from django.db import transaction, connection
from django.utils import timezone

from kpi.models import ImportTask


class Command(BaseCommand):

    help = "Deletes import tasks"

    def add_arguments(self, parser):
        super(Command, self).add_arguments(parser)
        parser.add_argument(
            "--days",
            default=90,
            type=int,
            help="Delete only import tasks older than the specified number of days.",
        )

        parser.add_argument(
            "--chunks",
            default=1000,
            type=int,
            help="Delete only import tasks by batch of `chunks` records.",
        )

        parser.add_argument(
            "--vacuum",
            action='store_true',
            default=False,
            help="Run `VACUUM` on tables after deletion.",
        )

        parser.add_argument(
            "--vacuum-full",
            action='store_true',
            default=False,
            help="Run `VACUUM FULL` instead of `VACUUM`.",
        )

    def handle(self, *args, **options):
        print(options)
        days = options["days"]
        chunks = options["chunks"]
        verbosity = options["verbosity"]
        vacuum_full = options["vacuum_full"]
        vacuum = options["vacuum"]

        tasks_to_delete = ImportTask.objects.filter(
            date_created__lt=timezone.now() - timedelta(days=days),
        )
        chunked_delete_ids = []
        chunks_cpt = 1
        tasks_to_delete_count = tasks_to_delete.count()

        for import_task_id in tasks_to_delete.values_list("id", flat=True).iterator():
            if (chunks_cpt % chunks) != 0 and chunks_cpt < tasks_to_delete_count:
                chunked_delete_ids.append(import_task_id)
            else:
                print(chunked_delete_ids)
                if len(chunked_delete_ids) > 0:
                    with transaction.atomic():  # Wrap into a transaction because of CASCADE, post_delete signals
                        chuncked_import_tasks_to_delete = ImportTask.objects.filter(id__in=chunked_delete_ids)
                        if verbosity >= 1:
                            progress = "\rDeleting {chunk}/{total} import tasks...".format(
                                chunk=chunks_cpt,
                                total=tasks_to_delete_count
                            )
                            sys.stdout.write(progress)
                            sys.stdout.flush()
                        chuncked_import_tasks_to_delete.delete()
                        chunked_delete_ids = []

            chunks_cpt += 1

        if vacuum is True or vacuum_full is True:
            self.do_vacuum(vacuum_full)

        print("Done!")

    def do_vacuum(self, full=False):
        cursor = connection.cursor()
        if full:
            print("Vacuuming (full) table {}...".format(ImportTask._meta.db_table))
            cursor.execute("VACUUM FULL {}".format(ImportTask._meta.db_table))
        else:
            print("Vacuuming table {}...".format(ImportTask._meta.db_table))
            cursor.execute("VACUUM {}".format(ImportTask._meta.db_table))
        connection.commit()
