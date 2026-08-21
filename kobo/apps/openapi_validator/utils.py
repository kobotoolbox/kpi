from django.urls import resolve


def get_django_route(path: str) -> str | None:
    """
    Return the canonical Django route/pattern for a concrete path.
    """
    try:
        match = resolve(path)
    except Exception:
        return None

    route = getattr(match, 'route', None)
    if route:
        # Strip regex anchors so path() and re_path() declarations of the same
        # URL produce the same route string (whitelist keys stay stable)
        route = route.lstrip('^').rstrip('$')

    return route
