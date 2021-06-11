# coding: utf-8
from celery import shared_task

from django.db.models import Q

from kobo.static_lists import COUNTRIES
# Make sure this app is listed in `INSTALLED_APPS`; otherwise, Celery will
# complain that the task is unregistered

@shared_task
def generate_country_report(output_filename):
    import unicodecsv
    from django.core.files.storage import get_storage_class    
    from kpi.constants import ASSET_TYPE_SURVEY
    from kpi.deployment_backends.kc_access.shadow_models import (
        ReadOnlyKobocatInstance,
        ReadOnlyKobocatXForm,
    )

    def format_date(d):
        if hasattr(d, 'strftime'):
            return d.strftime('%F')
        else:
            return d

    def get_row_for_country(c):
        row = []

        try:
            kpi_forms = Asset.objects.filter(
                asset_type=ASSET_TYPE_SURVEY,
                settings__country__label=str(c)
            )
            count = 0
            for kpi_form in kpi_forms:
                xform = ReadOnlyKobocatXForm.objects.get(id_string=kpi_form.uid)
                count += ReadOnlyKobocatInstance.objects.filter(xform=xform).count()
        except:
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