# coding: utf-8
from __future__ import (unicode_literals, print_function,
                        absolute_import, division)

from django.core.urlresolvers import (
    get_script_prefix,
    resolve
)
from django.utils.encoding import uri_to_iri
from django.utils.six.moves.urllib.parse import urlparse


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
