# coding: utf-8
from datetime import timedelta
import sys

from django.conf import settings
from django.db import transaction, models, router, connections
from django.utils import timezone
from reversion.models import Revision, Version
from reversion.management.commands.deleterevisions import Command as RevisionCommand


class Command(RevisionCommand):

    help = "Deletes revisions (by chunks) for a given app [and model]"

    def add_arguments(self, parser):
        super().add_arguments(parser)

        parser.add_argument(
            "--chunks",
            default=1000,
            type=int,
            help="Delete only revisions by batch of `chunks` records.",
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

    def handle(self, *app_labels, **options):
        verbosity = options["verbosity"]
        using = options["using"]
        model_db = options["model_db"]
        days = options["days"]
        keep = options["keep"]
        chunks = options["chunks"]
        vacuum_full = options["vacuum_full"]
        vacuum = options["vacuum"]

        # Delete revisions.
        using = using or router.db_for_write(Revision)
        revisions_to_delete_count = 0

        revision_query = models.Q()
        keep_revision_ids = set()
        # By default, delete nothing.
        can_delete = False
        # Get all revisions for the given revision manager and model.
        for model in self.get_models(options):
            if verbosity >= 1:
                self.stdout.write("Finding stale revisions for {name}".format(
                    name=model._meta.verbose_name,
                ))
            # Find all matching revision IDs.
            model_query = Version.objects.using(using).get_for_model(
                model,
                model_db=model_db,
            )
            if keep:
                overflow_object_ids = list(Version.objects.using(using).get_for_model(
                    model,
                    model_db=model_db,
                ).order_by().values_list("object_id").annotate(
                    count=models.Count("object_id"),
                ).filter(
                    count__gt=keep,
                ).values_list("object_id", flat=True).iterator())
                # Only delete overflow revisions.
                model_query = model_query.filter(object_id__in=overflow_object_ids)
                for object_id in overflow_object_ids:
                    if verbosity >= 2:
                        self.stdout.write("- Finding stale revisions for {name} #{object_id}".format(
                            name=model._meta.verbose_name,
                            object_id=object_id,
                        ))
                    # But keep the underflow revisions.
                    keep_revision_ids.update(Version.objects.using(using).get_for_object_reference(
                        model,
                        object_id,
                        model_db=model_db,
                    ).values_list("revision_id", flat=True)[:keep].iterator())
            # Add to revision query.
            revision_query |= models.Q(
                pk__in=model_query.order_by().values_list("revision_id", flat=True)
            )
            # If we have at least one model, then we can delete.
            can_delete = True
        if can_delete:
            revisions_to_delete = Revision.objects.using(using).filter(
                revision_query,
                date_created__lt=timezone.now() - timedelta(days=days),
            ).exclude(
                pk__in=keep_revision_ids
            ).order_by()
        else:
            revisions_to_delete = Revision.objects.using(using).none()
        # Print out a message, if feeling verbose.
        if verbosity >= 1:
            revisions_to_delete_count = revisions_to_delete.count()

        chunked_delete_ids = []
        chunks_counter = 1

        for revision_id in revisions_to_delete.values_list("id", flat=True).iterator():

            chunked_delete_ids.append(revision_id)

            if (chunks_counter % chunks) == 0 or chunks_counter == revisions_to_delete_count:
                # Wrap into a transaction because of CASCADE, post_delete signals. (e.g. `revision_revision`)
                with transaction.atomic(using=using):
                    chunked_revisions_to_delete = Revision.objects.filter(id__in=chunked_delete_ids)
                    if verbosity >= 1:
                        progress = "\rDeleting {chunk}/{total} revisions...".format(
                            chunk=chunks_counter,
                            total=revisions_to_delete_count
                        )
                        sys.stdout.write(progress)
                        sys.stdout.flush()
                    chunked_revisions_to_delete.delete()
                chunked_delete_ids = []
            chunks_counter += 1

        # Carriage return
        print("")

        if vacuum is True or vacuum_full is True:
            self._do_vacuum(vacuum_full)

        print("Done!")

    @staticmethod
    def _do_vacuum(full=False):
        connection = connections[settings.OPENROSA_DB_ALIAS]
        cursor = connection.cursor()
        if full:
            print("Vacuuming (full) table {}...".format(Revision._meta.db_table))
            cursor.execute("VACUUM FULL {}".format(Revision._meta.db_table))
            print("Vacuuming (full) table {}...".format(Version._meta.db_table))
            cursor.execute("VACUUM FULL {}".format(Version._meta.db_table))
        else:
            print("Vacuuming table {}...".format(Revision._meta.db_table))
            cursor.execute("VACUUM {}".format(Revision._meta.db_table))
            print("Vacuuming table {}...".format(Version._meta.db_table))
            cursor.execute("VACUUM {}".format(Version._meta.db_table))
        connection.commit()
