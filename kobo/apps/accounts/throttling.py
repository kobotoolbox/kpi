import hashlib

import constance
from rest_framework.exceptions import APIException
from rest_framework.throttling import SimpleRateThrottle


class EmailConfirmationRequestEmailThrottle(SimpleRateThrottle):
    """
    Per-address limit on the unauthenticated "resend confirmation email" endpoint

    The limit follows the recipient rather than the caller, so one inbox cannot be
    flooded by spreading requests across different source addresses.

    Counting uses an atomic Redis counter rather than DRF's default, which reads
    and rewrites a list in separate steps and so lets simultaneous requests each
    pass as though they were the first. The trade is a fixed window: a burst
    landing on a window boundary can briefly reach twice the limit.
    """

    scope = 'email_confirmation_request_email'

    def get_rate(self):
        # Stored as a plain number, so an admin cannot enter a rate string DRF
        # fails to parse. 0 disables the limit; without this it would parse as
        # "allow nothing" and break every account activation
        per_hour = constance.config.EMAIL_CONFIRMATION_REQUESTS_PER_HOUR
        return f'{per_hour}/hour' if per_hour else None

    def allow_request(self, request, view):
        """
        Count this request and report whether it is still within the limit
        """
        if self.rate is None:
            return True

        self.key = self.get_cache_key(request, view)
        if self.key is None:
            return True

        return self._consume(self.key) <= self.num_requests

    def _consume(self, key):
        """
        Count one request against the current window and return the new total

        `add` succeeds only when no window is open, so exactly one request starts
        the count and every other one increments it.
        """
        if self.cache.add(key, 1, self.duration):
            return 1

        try:
            return self.cache.incr(key)
        except ValueError:
            # The window expired between `add` and `incr`; start a fresh one
            self.cache.set(key, 1, self.duration)
            return 1

    def wait(self):
        """
        Seconds until the window resets, for the `Retry-After` header
        """
        return self.duration

    def get_cache_key(self, request, view):
        try:
            data = request.data
        except APIException:
            # Unparseable body; the view will reject it, and no mail can be sent
            # for a request that never yields an address
            return None

        email = data.get('email') if hasattr(data, 'get') else None
        if not isinstance(email, str) or not email.strip():
            return None

        # Hash rather than store the address: throttle keys live in Redis and
        # surface in its logs and monitoring, and a raw address there would
        # disclose exactly which inboxes have been probed
        ident = hashlib.sha256(email.strip().lower().encode()).hexdigest()
        # The cache key format is inherited from `SimpleRateThrottle.cache_format`
        # and follows the pattern: 'throttle_<scope>_<ident>'
        return self.cache_format % {'scope': self.scope, 'ident': ident}
