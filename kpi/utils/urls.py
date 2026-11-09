from collections.abc import Callable
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
from django.views import View
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
    A name can be qualified by its closest namespaces (e.g. `mfa:reauthenticate`)
    when the bare name is not unique. Namespaces and app names are kept, so
    reversing the remaining routes is unaffected. Raises `ImproperlyConfigured`
    when a name matches no route, so a route renamed upstream cannot quietly
    come back
    """
    kept, excluded = _rewrite_routes(patterns, names, lambda pattern, name: None)
    if missing := names - excluded:
        raise ImproperlyConfigured(
            f'No route to exclude is named {", ".join(sorted(missing))}'
        )
    return kept


def replace_route_views(
    patterns: list[URLPattern | URLResolver], views: dict[str, type[View]]
) -> list[URLPattern | URLResolver]:
    """
    Return `patterns` with the view of each route named in `views` replaced by
    the given subclass of that view, at any depth

    Use it to change a third-party view instead of masking its route with an
    earlier pattern on the same path, which would silently stop applying if the
    path changed upstream. The route keeps its path, name and namespaces, and
    the replacement is built with the original view's init kwargs (e.g. the
    `client` of allauth's headless views). Names are matched as in
    `exclude_routes()`. Raises `ImproperlyConfigured` when a name matches no
    route, or when a replacement does not subclass the view it replaces
    """

    def replace(pattern: URLPattern, name: str) -> URLPattern:
        view_class = views[name]
        original = getattr(pattern.callback, 'view_class', None)
        if original is None or not issubclass(view_class, original):
            raise ImproperlyConfigured(
                f'{view_class.__name__} does not subclass the view of the {name} route'
            )
        # allauth's headless views wrap `as_view()` for their client
        build = getattr(view_class, 'as_api_view', view_class.as_view)
        return URLPattern(
            pattern.pattern,
            build(**pattern.callback.view_initkwargs),
            pattern.default_args,
            pattern.name,
        )

    replaced, matched = _rewrite_routes(patterns, set(views), replace)
    if missing := set(views) - matched:
        raise ImproperlyConfigured(
            f'No route to replace is named {", ".join(sorted(missing))}'
        )
    return replaced


def _rewrite_routes(
    patterns: list[URLPattern | URLResolver],
    names: set[str],
    rewrite: Callable[[URLPattern, str], URLPattern | None],
    namespaces: tuple[str, ...] = (),
) -> tuple[list[URLPattern | URLResolver], set[str]]:
    """
    Return `patterns` with each route named in `names` passed through
    `rewrite()`, which returns its replacement or `None` to drop it, and the
    names that matched a route
    """
    rewritten = []
    matched = set()
    for pattern in patterns:
        if isinstance(pattern, URLResolver):
            nested, nested_matched = _rewrite_routes(
                pattern.url_patterns,
                names,
                rewrite,
                (*namespaces, pattern.namespace) if pattern.namespace else namespaces,
            )
            matched |= nested_matched
            rewritten.append(
                URLResolver(
                    pattern.pattern,
                    nested,
                    pattern.default_kwargs,
                    pattern.app_name,
                    pattern.namespace,
                )
            )
            continue

        name = _match_route_name(pattern, namespaces, names)
        if name is None:
            rewritten.append(pattern)
            continue
        matched.add(name)
        if (replacement := rewrite(pattern, name)) is not None:
            rewritten.append(replacement)
    return rewritten, matched


def _match_route_name(
    pattern: URLPattern, namespaces: tuple[str, ...], names: set[str]
) -> str | None:
    """
    Return the entry of `names` that names `pattern`, either bare or qualified
    by the namespaces closest to it
    """
    if pattern.name is None:
        return None
    qualified = ':'.join((*namespaces, pattern.name))
    matches = [
        name for name in names if qualified == name or qualified.endswith(f':{name}')
    ]
    if len(matches) > 1:
        # e.g. `reauthenticate` and `mfa:reauthenticate`: which one applies
        # would depend on the iteration order of the set
        raise ImproperlyConfigured(
            f'Several names match the {qualified} route: {", ".join(sorted(matches))}'
        )
    return matches[0] if matches else None
