# coding: utf-8
import sys

from django.core.management.base import BaseCommand
from django.db import transaction, connection


# TODO: Remove `delete_base_command` from the output of `./manage.py --help`
# or print an informative message if someone tries to use it. Currently,
# it just raises `AttributeError: 'module' object has no attribute 'Command'`


class DeleteBaseCommand(BaseCommand):

    def __init__(self, stdout=None, stderr=None, no_color=False):
        super().__init__(stdout=stdout, stderr=stderr, no_color=no_color)
        self._model = None

    def add_arguments(self, parser):
        super().add_arguments(parser)
        parser.add_argument(
            "--days",
            default=90,
            type=int,
            help="Delete only records older than the specified number of days.",
        )

        parser.add_argument(
            "--chunks",
            default=1000,
            type=int,
            help="Delete only records by batch of `chunks`.",
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

        chunks = options["chunks"]
        verbosity = options["verbosity"]
        vacuum_full = options["vacuum_full"]
        vacuum = options["vacuum"]

        delete_queryset = self._prepare_delete_queryset(**options)
        if self._model is None:
            raise Exception("No models declared!")

        chunked_delete_ids = []
        chunks_counter = 1
        total = delete_queryset.count()

        for record_id in delete_queryset.values_list("id", flat=True).iterator():

            chunked_delete_ids.append(record_id)

            if (chunks_counter % chunks) == 0 or chunks_counter == total:
                with transaction.atomic():  # Wrap into a transaction because of CASCADE, post_delete signals
                    chunked_objects_to_delete = self._model.objects.filter(id__in=chunked_delete_ids)
                    if verbosity >= 1:
                        progress = "\rDeleting {chunk}/{total} records...".format(
                            chunk=chunks_counter,
                            total=total
                        )
                        sys.stdout.write(progress)
                        sys.stdout.flush()
                    chunked_objects_to_delete.delete()
                chunked_delete_ids = []

            chunks_counter += 1

        # Print new line
        print("")

        if vacuum is True or vacuum_full is True:
            self._do_vacuum(vacuum_full)

        print("Done!")

    def _prepare_delete_queryset(self, **options):
        raise Exception("Must be implemented in child class")

    def _do_vacuum(self, full=False):
        cursor = connection.cursor()
        if full:
            print("Vacuuming (full) table {}...".format(self._model._meta.db_table))
            cursor.execute("VACUUM FULL {}".format(self._model._meta.db_table))
        else:
            print("Vacuuming table {}...".format(self._model._meta.db_table))
            cursor.execute("VACUUM {}".format(self._model._meta.db_table))
        connection.commit()
