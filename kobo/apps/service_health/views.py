# coding: utf-8
import time
from typing import Callable, Optional, Tuple

import requests
from django.conf import settings
from django.core.cache import cache, caches
from django.http import HttpResponse

from kobo.apps.openrosa.apps.main.models.user_profile import UserProfile
from kobo.celery import celery_app
from kpi.models import Asset
from kpi.utils.log import logging


def get_response(url_):
    message = 'OK'
    failure = False
    content = None

    try:
        # response timeout changed to 10 seconds from 45 as requested in
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
            message = 'Response status code is {}'.format(status_code)

    return failure, message, content


def check_status(
    service_name: str, check_function: Callable
) -> Tuple[Optional[str], float]:
    """
    Check service via callable function.
    If an exception is raised, return the class name for public consumption.
    Log the full exception information. This prevents information leakage
    """
    error = None
    t0 = time.time()
    try:
        check_function()
    except Exception as exception:
        logging.error(f'Service health {service_name} check failure', exc_info=True)
        error = repr(type(exception).__name__)
    cache_time = time.time() - t0
    return error, cache_time


def service_health(request):
    """
    Return a HTTP 200 if some very basic runtime tests of the application
    pass. Otherwise, return HTTP 500
    """
    all_checks = {
        'Mongo': lambda: settings.MONGO_DB.instances.find_one(),
        'Postgres kpi': lambda: Asset.objects.order_by().exists(),
        'Postgres kobocat': lambda: UserProfile.objects.exists(),
        'Cache': lambda: cache.set('a', True, 1),
        'Broker': lambda: celery_app.backend.client.ping(),
        'Session': lambda: request.session.save(),
        'Enketo': lambda: requests.get(
            settings.ENKETO_INTERNAL_URL, timeout=10
        ).raise_for_status(),
        'Enketo Redis (main)': lambda: caches['enketo_redis_main'].set('a', True, 1),
    }

    check_results = []
    any_failure = False
    for service_name, check_function in all_checks.items():
        service_message, service_time = check_status(service_name, check_function)
        any_failure = True if service_message else any_failure
        check_results.append(
            f"{service_name}: {service_message or 'OK'} in {service_time:.3} seconds"
        )

    output = f"{'FAIL' if any_failure else 'OK'} KPI\r\n\r\n"
    output += '\r\n'.join(check_results)

    return HttpResponse(
        output, status=(500 if any_failure else 200), content_type='text/plain'
    )
