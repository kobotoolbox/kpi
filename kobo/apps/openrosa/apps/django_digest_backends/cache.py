from django.core.cache import caches
from django_digest.utils import get_setting
from redis.exceptions import LockError

NONCE_NO_COUNT = ''  # Needs to be something other than None to determine not set vs set to null


class RedisCacheNonceStorage:
    _blocking_timeout = 30

    def _get_cache(self):
        # Dynamic fetching of cache is necessary to work with override_settings
        return caches[get_setting('DIGEST_NONCE_CACHE_NAME', 'default')]

    def _get_timeout(self):
        return get_setting('DIGEST_NONCE_TIMEOUT_IN_SECONDS', 5 * 60)

    def _generate_cache_key(self, user, nonce):
        return f'user_nonce_{user}_{nonce}'

    def update_existing_nonce(self, user, nonce, nonce_count):
        """
        Check and update nonce record. If no record exists or has an invalid count,
        return False. Create a lock to prevent a concurrent replay attack where
        two requests are sent immediately and either may finish first.
        """
        cache = self._get_cache()
        cache_key = self._generate_cache_key(user, nonce)

        if nonce_count == None:  # No need to lock
            existing = cache.get(cache_key)
            if existing is None:
                return False
            cache.set(cache_key, NONCE_NO_COUNT, self._get_timeout())
        else:
            try:
                with cache.lock(
                    f'user_nonce_lock_{user}_{nonce}',
                    timeout=self._get_timeout(),
                    blocking_timeout=self._blocking_timeout
                ):
                    existing = cache.get(cache_key)
                    if existing is None:
                        return False
                    if nonce_count <= existing:
                        return False
                    cache.set(cache_key, nonce_count, self._get_timeout())
            except LockError:
                cache.delete(cache_key)
                return False
        return True

    def store_nonce(self, user, nonce, nonce_count):
        # Nonce is required
        if nonce is None or len(nonce) <= 1:
            return False
        if nonce_count is None:
            nonce_count = NONCE_NO_COUNT
        cache = self._get_cache()
        cache_key = self._generate_cache_key(user, nonce)
        return cache.set(cache_key, nonce_count, self._get_timeout())
