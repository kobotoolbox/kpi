# coding: utf-8
import time

from django.conf import settings
from django.http import HttpResponse

from kobo.apps.openrosa.apps.logger.models import Instance


def service_health(request):
    """
    Return a HTTP 200 if some very basic runtime tests of the application
    pass. Otherwise, return HTTP 500
    """
    any_failure = False

    t0 = time.time()
    try:
        settings.MONGO_DB.instances.find_one()
    except Exception as e:
        mongo_message = repr(e)
        any_failure = True
    else:
        mongo_message = 'OK'
    mongo_time = time.time() - t0

    t0 = time.time()
    try:
        Instance.objects.first()
    except Exception as e:
        postgres_message = repr(e)
        any_failure = True
    else:
        postgres_message = 'OK'
    postgres_time = time.time() - t0

    output = (
        '{}\r\n\r\n'
        'Mongo: {} in {:.3} seconds\r\n'
        'Postgres: {} in {:.3} seconds\r\n'
    ).format(
        'FAIL' if any_failure else 'OK',
        mongo_message, mongo_time,
        postgres_message, postgres_time,
    )

    return HttpResponse(
        output, status=(500 if any_failure else 200), content_type='text/plain'
    )

def service_health_minimal(request):
    return HttpResponse('ok', content_type='text/plain')
