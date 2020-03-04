# coding: utf-8
from datetime import timedelta

from django.utils import timezone

from .remove_base_command import RemoveBaseCommand
from kpi.models import ImportTask


class Command(RemoveBaseCommand):

    help = "Removes import tasks"

    def _prepare_delete_queryset(self, **options):
        days = options["days"]
        self._model = ImportTask
        return self._model.objects.filter(
            date_created__lt=timezone.now() - timedelta(days=days),
        )

