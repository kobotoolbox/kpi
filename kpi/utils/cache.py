# -*- coding: utf-8 -*-
from functools import wraps

from django_request_cache import get_request_cache


def void_cache_for_request(keys):
    """
    Decorator that removes keys from to current request cache
    Useful to void cache if content has to be refreshed within
    the same request (e.g. on save() or delete())

    Args:
        keys (tuple): Substrings to be searched for

    """
    def _void_cache_for_request(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache = get_request_cache()
            # We need to prefix keys because of the way `django_request_cache`
            # stored its keys
            if cache:
                prefixed_keys = tuple(["('{}".format(key) for key in keys])
                cache_keys = list(cache.__dict__.keys())
                for key in cache_keys:
                    if key.startswith(prefixed_keys):
                        delattr(cache, key)
            return func(*args, **kwargs)
        return wrapper
    return _void_cache_for_request
