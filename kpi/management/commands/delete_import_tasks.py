# coding: utf-8
from datetime import timedelta

from django.utils import timezone

from kpi.management.delete_base_command import DeleteBaseCommand
from kpi.models import ImportTask


class Command(DeleteBaseCommand):

    help = "Deletes import tasks"

    def _prepare_delete_queryset(self, **options):
        days = options["days"]
        self._model = ImportTask
        return self._model.objects.filter(
            date_created__lt=timezone.now() - timedelta(days=days),
        )

