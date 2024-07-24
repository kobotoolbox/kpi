# coding: utf-8
from django.core.management.base import BaseCommand

from kobo.apps.openrosa.apps.restservice.models import RestService


class Command(BaseCommand):
    """
    A faster method is available with PostgreSQL:
        UPDATE restservice_restservice
            SET service_url = REGEXP_REPLACE(
                service_url,
                '/assets/([^/]*)/submissions/',
                '/api/v2/assets/\1/hook-signal/'
            )
            WHERE service_url LIKE '/assets/%';
    """

    help = 'Updates KPI rest service endpoint'

    def handle(self, *args, **kwargs):

        rest_services = RestService.objects.filter(name='kpi_hook').all()
        for rest_service in rest_services:
            service_url = rest_service.service_url
            do_save = False
            if service_url.endswith('/submissions/'):
                service_url = service_url.replace('/submissions/', '/hook-signal/')
                rest_service.service_url = service_url
                do_save = True
                rest_service.save(update_fields=["service_url"])

            if service_url.startswith('/assets/'):
                service_url = service_url.replace('/assets/', '/api/v2/assets/')
                rest_service.service_url = service_url
                do_save = True

            if do_save:
                rest_service.save(update_fields=["service_url"])

        print('Done!')
