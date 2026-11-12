import datetime
import hashlib
from contextlib import ExitStack, contextmanager

import constance
import django.dispatch
from allauth.account.adapter import get_adapter
from allauth.core.internal.ratelimit import Rate, cache_lock, parse_rates
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from rest_framework.exceptions import APIException, Throttled
from rest_framework.throttling import SimpleRateThrottle

auth_success = django.dispatch.Signal()

SETTINGS_BY_SCOPE = {
    'login_failed': 'LOGIN_FAILED_RATE_LIMIT',
}


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

    # Retries for the expiring-window race in `_consume()`. Losing it twice
    # running would need two expiries inside the same handful of microseconds
    CONSUME_ATTEMPTS = 3

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
        the count and every other one increments it. A window expiring between
        the two calls just means going round again: whoever opens the next window
        wins, and this request counts against it rather than overwriting it.
        """
        for _ in range(self.CONSUME_ATTEMPTS):
            if self.cache.add(key, 1, self.duration):
                return 1
            try:
                return self.cache.incr(key)
            except ValueError:
                # The window expired between `add` and `incr`
                continue

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


@contextmanager
def rate_limit(scope, username, request, rollback_signal=None):
    setting = SETTINGS_BY_SCOPE[scope]
    limits = getattr(settings, setting)
    if not limits:
        yield
    rates = {rate.per: rate for rate in parse_rates(limits)}
    identifiers = {'ip': get_adapter().get_client_ip(request), 'key': username}
    with ExitStack() as stack:
        for per, rate in rates.items():
            stack.enter_context(
                single_rate_limit(
                    scope=scope,
                    identifier_type=per,
                    identifier=identifiers[per],
                    rate=rate,
                    rollback_signal=rollback_signal,
                )
            )
        yield


@contextmanager
def single_rate_limit(
    scope: str,
    identifier_type: str,
    identifier: str,
    rate: Rate,
    rollback_signal: django.dispatch.Signal | None = None,
):
    cache_key = f'{scope}:{identifier_type}:{identifier}'
    with cache_lock(cache_key) as locked:
        if locked:
            now = timezone.now()
            cutoff_time = now - datetime.timedelta(seconds=rate.duration)
            history = cache.get(cache_key, [])

            def rollback_history(*args, **kwargs):
                history.pop()
                cache.set(cache_key, history, timeout=rate.duration)

            while len(history) > 0 and history[0] < cutoff_time:
                history.pop(0)
            if len(history) >= rate.amount:
                raise Throttled()
            history.append(now)
            cache.set(cache_key, history, timeout=rate.duration)
            if rollback_signal:
                rollback_signal.connect(rollback_history)
            try:
                yield
            finally:
                if rollback_signal:
                    rollback_signal.disconnect(rollback_history)
        else:
            raise Throttled()
