# coding: utf-8
import unicodecsv
from celery import shared_task

from django.core.files.storage import get_storage_class

from kobo.static_lists import COUNTRIES
from kpi.constants import ASSET_TYPE_SURVEY
from kpi.deployment_backends.kc_access.shadow_models import (
    KobocatXForm,
    ReadOnlyKobocatInstance,
)
from kpi.models.asset import Asset
# Make sure this app is listed in `INSTALLED_APPS`; otherwise, Celery will
# complain that the task is unregistered

@shared_task
def generate_country_report(output_filename, request):

    def get_context_data(self, **kwargs):
        context = super.get_context_data(**kwargs)
        return context

    def format_date(d):
        if hasattr(d, 'strftime'):
            return d.strftime('%F')
        else:
            return d

    def get_row_for_country(c):
        row = []
        context = get_context_data()
        start_date = context["start_date"]
        end_date = context["end_date"]
        try:
            kpi_forms = Asset.objects.filter(
                asset_type=ASSET_TYPE_SURVEY,
                settings__country__label=str(c),
                date_created__gte=start_date,
                date_created__lte=end_date
            )
            count = 0
            for kpi_form in kpi_forms:
                xform = KobocatXForm.objects.get(id_string=kpi_form.uid)
                count += ReadOnlyKobocatInstance.objects.filter(
                    xform=xform).count()
        except Exception as e:
            count = 0

        row.append(c)
        row.append(count)

        return row

    CHUNK_SIZE = 1000
    columns = [
        'Country',
        'Count',
    ]

    default_storage = get_storage_class()()
    with default_storage.open(output_filename, 'wb') as output_file:
        writer = unicodecsv.writer(output_file)
        writer.writerow(columns)
        c = None

        for country in COUNTRIES:
            c = country[1]

            try:
                row = get_row_for_country(c)
            except Exception as e:
                row = ['!FAILED!', 'Country: {}'.format(c), repr(e)]
            writer.writerow(row)
