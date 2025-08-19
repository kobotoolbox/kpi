# coding: utf-8
from django.core.management.base import BaseCommand

from kobo.apps.openrosa.apps.viewer.models.data_dictionary import DataDictionary
from kobo.apps.openrosa.libs.utils.model_tools import queryset_iterator


class Command(BaseCommand):
    help = "Insert UUID into XML of all existing XForms"

    def handle(self, *args, **kwargs):
        print ('%(nb)d XForms to update'
               % {'nb': DataDictionary.objects.count()})
        for i, dd in enumerate(
                queryset_iterator(DataDictionary.objects.all())):
            if dd.xls:
                dd.set_uuid_in_xml()
                super(DataDictionary, dd).save()
            if (i + 1) % 10 == 0:
                print('Updated %(nb)d XForms...' % {'nb': i})
