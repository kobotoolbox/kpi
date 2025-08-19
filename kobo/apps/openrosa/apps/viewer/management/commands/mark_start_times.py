# coding: utf-8
from django.core.management.base import BaseCommand

from kobo.apps.openrosa.apps.viewer.models.data_dictionary import DataDictionary


class Command(BaseCommand):
    help = ("This is a one-time command to "
            "mark start times of old surveys.")

    def handle(self, *args, **kwargs):
        for dd in DataDictionary.objects.all():
            try:
                dd.mark_start_time_boolean()
                dd.save()
            except Exception:
                print ("Could not mark start time for DD: %(data)s" % {
                    'data': repr(dd)})
