from datetime import timedelta
from functools import wraps

from django.utils import timezone
from django_redis import get_redis_connection
from django_request_cache import cache_for_request, get_request_cache


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


class CachedClass:
    """
    Handles a mapping cache for a class. It supports only getter methods that
    receive no parameters but the self.

    The inheriting class must define a function _get_cache_hash that creates a
    unique name string for the underlying HSET.

    The inheriting class should call self._setup_cache() at __init__

    The TTL is configured through the class property CACHE_TTL.

    This class must be used with the decorator defined below,
    cached_class_property, which will be used to specify what class methods are
    cached.
    """

    CACHE_TTL = None

    @cache_for_request
    def _cache_last_updated(self):
        if not self._cache_available:
            return timezone.now()

        remaining_seconds = self._redis_client.ttl(self._cache_hash_str)
        return timezone.now() - timedelta(seconds=self.CACHE_TTL - remaining_seconds)

    def _clear_cache(self):
        if not self._cache_available:
            return

        self._redis_client.delete(self._cache_hash_str)
        self._cached_hset = {}

    def _handle_cache_expiration(self):
        """
        Checks if the hset is initialized, and initializes if necessary
        """
        if not self._cache_available:
            return

        if not self._cached_hset.get(b'__initialized__'):
            self._redis_client.hset(self._cache_hash_str, '__initialized__', 'True')
            self._redis_client.expire(self._cache_hash_str, self.CACHE_TTL)
            self._cached_hset[b'__initialized__'] = True

    def _setup_cache(self):
        """
        Sets up the cache client and the cache hash name for the hset
        """
        if getattr(self, '_cache_available', None) is False:
            return

        self._redis_client = None
        self._cache_available = True
        self._cached_hset = {}
        try:
            self._redis_client = get_redis_connection('default')
        except NotImplementedError:
            self._cache_available = False
            return

        self._cache_hash_str = self._get_cache_hash()
        assert self.CACHE_TTL > 0, 'Set a valid value for CACHE_TTL'
        self._cached_hset = self._redis_client.hgetall(self._cache_hash_str)
        self._handle_cache_expiration()


def cached_class_property(key, serializer=str, deserializer=str):
    """
    Function decorator that takes a key to store/retrieve a cached key value and
    serializer and deserializer functions to convert the value for storage or
    retrieval, respectively.
    """

    def cached_key_getter(func):
        def wrapper(self):
            if getattr(self, '_cache_available', None) is False:
                return func(self)

            self._handle_cache_expiration()
            value = self._cached_hset.get(key.encode())
            if value is None:
                value = func(self)
                serialized_value = serializer(value)
                self._redis_client.hset(self._cache_hash_str, key, serialized_value)
                self._cached_hset[key.encode()] = serialized_value
            else:
                value = deserializer(value)

            return value

        return wrapper

    return cached_key_getter
