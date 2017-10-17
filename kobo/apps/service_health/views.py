import requests
import time

from django.conf import settings
from django.http import HttpResponse

from kpi.models import Asset

def service_health(request):
    ''' Return a HTTP 200 if some very basic runtime tests of the application
    pass. Otherwise, return HTTP 500 '''
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
        Asset.objects.first()
    except Exception as e:
        postgres_message = repr(e)
        any_failure = True
    else:
        postgres_message = 'OK'
    postgres_time = time.time() - t0

    t0 = time.time()
    try:
        enketo_response = requests.get(settings.ENKETO_SERVER, timeout=45)
        enketo_response.raise_for_status()
    except Exception as e:
        enketo_response = None
        enketo_message = repr(e)
        any_failure = True
    else:
        enketo_message = 'OK'
    enketo_time = time.time() - t0

    t0 = time.time()
    try:
        kobocat_response = requests.get(
            settings.KOBOCAT_URL + '/service_health/', timeout=45)
        kobocat_response.raise_for_status()
    except Exception as e:
        kobocat_response = None
        kobocat_message = repr(e)
        any_failure = True
    else:
        kobocat_message = 'OK'
    kobocat_time = time.time() - t0

    output = (
        u'{}\r\n\r\n'
        u'Mongo: {} in {:.3} seconds\r\n'
        u'Postgres: {} in {:.3} seconds\r\n'
        u'Enketo: {} in {:.3} seconds\r\n'
        u'KoBoCAT: {} in {:.3} seconds\r\n'
    ).format(
        'FAIL' if any_failure else 'OK',
        mongo_message, mongo_time,
        postgres_message, postgres_time,
        enketo_message, enketo_time,
        kobocat_message, kobocat_time
    )

    if kobocat_response:
        output += (
            u'\r\n'
            u'----BEGIN KOBOCAT RESPONSE----\r\n'
            u'{}\r\n'
            u'---- END KOBOCAT RESPONSE ----\r\n'
        ).format(
            kobocat_response.content
        )

    return HttpResponse(
        output, status=(500 if any_failure else 200), content_type='text/plain'
    )
