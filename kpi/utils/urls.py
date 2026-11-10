from urllib.parse import urlparse

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.http import HttpRequest
from django.urls import (
    URLPattern,
    URLResolver,
    get_script_prefix,
    resolve,
)
from django.utils.encoding import uri_to_iri
from rest_framework.reverse import reverse

from kpi.constants import API_NAMESPACES


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
    return f'{settings.KOBOFORM_URL}{versioned_reverse(*args, **kwargs)}'


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


def versioned_reverse(
    viewname: str,
    args=None,
    kwargs=None,
    request=None,
    **extra,
) -> str:
    """
    Reverse a URL of the API and always return an absolute URL.

    DRF `reverse()` only returns an absolute URL when it receives a request,
    and it prepends `request.version` to the view name. That fails in two
    cases this function handles:

    - No request (Celery tasks, exports): the view name is resolved in the
      default API namespace and prefixed with `KOBOFORM_URL`.
    - `url_namespace` is given: the namespace is forced, whatever the version
      of the request is. Some endpoints (e.g. OpenRosa ones, whose version is
      `openrosa`) would otherwise build `openrosa:api_v2:...`, which does not
      exist. The request is not passed to `reverse()`, but its host is still
      used, so a caller that reaches KPI through the internal network (e.g.
      Enketo) gets internal URLs back. Without a request, `KOBOFORM_URL` is
      used.

    Otherwise, DRF `reverse()` is called with the request as usual.
    """

    if 'url_namespace' in extra:
        url_namespace = extra.pop('url_namespace', None)
        *_, viewname = viewname.split(':')
        url_namespace = f'{url_namespace}:' if url_namespace else ''
        viewname = f'{url_namespace}{viewname}'
        # Do not pass `request` to `reverse()`, its version would be prepended
        # to the namespace. Use its host instead, so that a call made through
        # the internal network gets internal URLs back.
        path = reverse(viewname, args=args, kwargs=kwargs, **extra)
        if request:
            return request.build_absolute_uri(path)
        return settings.KOBOFORM_URL + path

    if not request or not getattr(request, 'version', None):
        viewname = f"{API_NAMESPACES['default']}:{viewname}"
        return settings.KOBOFORM_URL + reverse(
            viewname, args=args, kwargs=kwargs, **extra
        )

    return reverse(viewname, args=args, kwargs=kwargs, request=request, **extra)


def exclude_routes(
    patterns: list[URLPattern | URLResolver], names: set[str]
) -> list[URLPattern | URLResolver]:
    """
    Return `patterns` without the routes named in `names`, at any depth

    Use it to drop a third-party route instead of masking it with an earlier
    pattern on the same path, which leaves the original registered behind it.
    Namespaces and app names are kept, so reversing the remaining routes is
    unaffected. Raises `ImproperlyConfigured` when a name matches no route, so a
    route renamed upstream cannot quietly come back
    """
    kept, excluded = _exclude_routes(patterns, names)
    if missing := names - excluded:
        raise ImproperlyConfigured(
            f'No route to exclude is named {", ".join(sorted(missing))}'
        )
    return kept


def _exclude_routes(
    patterns: list[URLPattern | URLResolver], names: set[str]
) -> tuple[list[URLPattern | URLResolver], set[str]]:
    kept = []
    excluded = set()
    for pattern in patterns:
        if isinstance(pattern, URLResolver):
            nested, nested_excluded = _exclude_routes(pattern.url_patterns, names)
            excluded |= nested_excluded
            kept.append(
                URLResolver(
                    pattern.pattern,
                    nested,
                    pattern.default_kwargs,
                    pattern.app_name,
                    pattern.namespace,
                )
            )
        elif pattern.name in names:
            excluded.add(pattern.name)
        else:
            kept.append(pattern)
    return kept, excluded
