from django.urls import resolve


def get_django_route(path: str) -> str | None:
    """
    Return the canonical Django route/pattern for a concrete path.
    """
    try:
        match = resolve(path)
    except Exception:
        return None

    return getattr(match, 'route', None)
