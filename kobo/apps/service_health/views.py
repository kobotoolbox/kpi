# coding: utf-8
import requests
import time

from django.conf import settings
from django.http import HttpResponse

from kpi.models import Asset


def get_response(url_):

    message = "OK"
    failure = False
    content = None

    try:
        # reponse timeout changed to 10 seconds from 45 as requested in 
        # issue linked here https://github.com/kobotoolbox/kpi/issues/2642
        response_ = requests.get(url_, timeout=10)
        response_.raise_for_status()
        content = response_.text
    except Exception as e:
        response_ = None
        message = repr(e)
        failure = True
    else:
        # Response can be something else than 200. We need to validate this.
        # For example: if domain name doesn't match, nginx returns a 204 status code.
        status_code = response_.status_code
        if status_code != 200:
            response_ = None
            content = None
            failure = True
            message = "Response status code is {}".format(status_code)

    return failure, message, content


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
        Asset.objects.order_by().first()
    except Exception as e:
        postgres_message = repr(e)
        any_failure = True
    else:
        postgres_message = 'OK'
    postgres_time = time.time() - t0

    t0 = time.time()
    failure, enketo_message, enketo_content = get_response(settings.ENKETO_INTERNAL_URL)
    any_failure = True if failure else any_failure
    enketo_time = time.time() - t0

    t0 = time.time()
    failure, kobocat_message, kobocat_content = get_response(settings.KOBOCAT_INTERNAL_URL + '/service_health/')
    any_failure = True if failure else any_failure
    kobocat_time = time.time() - t0

    output = (
        '{} KPI\r\n\r\n'
        'Mongo: {} in {:.3} seconds\r\n'
        'Postgres: {} in {:.3} seconds\r\n'
        'Enketo [{}]: {} in {:.3} seconds\r\n'
        'KoBoCAT [{}]: {} in {:.3} seconds\r\n'
    ).format(
        'FAIL' if any_failure else 'OK',
        mongo_message, mongo_time,
        postgres_message, postgres_time,
        settings.ENKETO_INTERNAL_URL, enketo_message, enketo_time,
        settings.KOBOCAT_INTERNAL_URL, kobocat_message, kobocat_time
    )

    if kobocat_content:
        output += (
            '\r\n'
            '----BEGIN KOBOCAT RESPONSE----\r\n'
            '{}\r\n'
            '---- END KOBOCAT RESPONSE ----\r\n'
        ).format(
            kobocat_content
        )

    return HttpResponse(
        output, status=(500 if any_failure else 200), content_type='text/plain'
    )
