# coding: utf-8
from urllib.parse import urlparse

from django.conf import settings
from django.http import HttpRequest
from django.urls import (
    get_script_prefix,
    resolve,
    reverse,
)
from django.utils.encoding import uri_to_iri


def absolute_resolve(url):
    """
    An extension of Django's `resolve()` that handles absolute URLs *or*
    relative paths.
    Mostly copied from rest_framework.serializers.HyperlinkedRelatedField.
    """
    try:
        http_prefix = url.startswith(('http:', 'https:'))
    except AttributeError:
        # `url` is not a string?!
        raise TypeError

    if http_prefix:
        path = urlparse(url).path
        prefix = get_script_prefix()
        if path.startswith(prefix):
            path = '/' + path[len(prefix):]
    else:
        path = url

    path = uri_to_iri(path)
    return resolve(path)


def absolute_reverse(*args, **kwargs):
    return f'{settings.KOBOFORM_URL}{reverse(*args, **kwargs)}'


def is_request_for_html(request: HttpRequest):
    """
    Try to determine if a request object is for an HTML page or an API resource
    """
    try:
        path_end = request.path.split('/')[-1]
        if path_end.endswith('.xml') or path_end.endswith('.json'):
            return True
    except IndexError:
        pass
    request_format = request.GET.get('format') or request.POST.get('format')
    return request.accepts('text/html') or (request_format and request_format != 'api')
