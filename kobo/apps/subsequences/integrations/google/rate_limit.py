from __future__ import annotations

import math
import time
from dataclasses import dataclass
from datetime import timezone as datetime_timezone
from email.utils import parsedate_to_datetime

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from kobo.apps.subsequences.exceptions import GoogleQuotaExceededError
from kpi.utils.log import logging


@dataclass(frozen=True)
class GoogleServiceRateLimitResult:
    allowed: bool
    retry_after: float = 0


class GoogleServiceRateLimitExceeded(GoogleQuotaExceededError):
    """
    Raised before starting a Google API request that would exceed shared quota
    """

    def __init__(self, quota_name: str, retry_after: float):
        self.quota_name = quota_name
        retry_after_seconds = max(1, math.ceil(retry_after))
        super().__init__(retry_after_seconds)
        self.args = (
            f'Google quota "{quota_name}" exhausted. '
            f'Retry after {retry_after_seconds} seconds.',
        )


def acquire_google_service_quota(
    quota_name: str,
) -> GoogleServiceRateLimitResult:
    """
    Checks whether a Google API request can be made without exceeding
    configured quota limits

    Uses Redis to count requests across all running server workers.
    Returns an object stating whether the request is 'allowed' right now,
    along with a 'retry_after' countdown timer if we are moving too fast.
    """
    config = settings.GOOGLE_SERVICE_RATE_LIMITS.get(quota_name)
    if not config:
        return GoogleServiceRateLimitResult(allowed=True)

    max_requests = config['max_requests']
    period_seconds = config['period_seconds']
    if max_requests <= 0:
        return GoogleServiceRateLimitResult(allowed=True)

    try:
        return _acquire_token_bucket_quota(
            quota_name,
            max_requests,
            period_seconds,
        )
    except Exception:
        logging.exception(
            'Google service quota token bucket failed; allowing request for '
            f'{quota_name=}'
        )
        return GoogleServiceRateLimitResult(allowed=True)


def require_google_service_quota(quota_name: str) -> None:
    result = acquire_google_service_quota(quota_name)
    if not result.allowed:
        raise GoogleServiceRateLimitExceeded(quota_name, result.retry_after)


def get_google_retry_after_seconds(
    err: Exception,
    default: int | None = None,
) -> int:
    """
    Extract Retry-After from Google exceptions when available

    google-api-core exceptions do not expose one stable public attribute across
    transports, so this checks common response/header shapes and falls back to a
    conservative quota-window delay.
    """
    if default is None:
        default = settings.GOOGLE_SERVICE_QUOTA_RETRY_AFTER

    retry = getattr(err, 'retry', None)
    if isinstance(retry, (int, float)):
        return max(1, math.ceil(retry))

    response = getattr(err, 'response', None) or getattr(err, '_response', None)
    headers = getattr(response, 'headers', None)
    retry_after = None
    if headers:
        retry_after = headers.get('Retry-After') or headers.get('retry-after')

    if retry_after:
        try:
            return max(1, math.ceil(float(retry_after)))
        except (TypeError, ValueError):
            try:
                retry_at = parsedate_to_datetime(retry_after)
                if timezone.is_naive(retry_at):
                    retry_at = timezone.make_aware(retry_at, datetime_timezone.utc)
                return max(1, math.ceil((retry_at - timezone.now()).total_seconds()))
            except (TypeError, ValueError, OverflowError):
                pass

    return max(1, int(default))


def _acquire_token_bucket_quota(
    quota_name: str,
    max_requests: int,
    period_seconds: float,
) -> GoogleServiceRateLimitResult:
    """
    Implements a distributed Token Bucket rate-limiter

    A bucket starts with `max_requests` tokens and refills at a constant rate
    over `period_seconds`. Each request consumes one token. If the bucket is
    empty, the request is denied, and we calculate exactly how many seconds
    until the next token will be available.
    """
    now = time.time()
    state_key = f'google-service-quota:{quota_name}:bucket'
    lock_key = f'google-service-quota:{quota_name}:lock'
    refill_rate = max_requests / period_seconds

    with cache.lock(lock_key, timeout=5, blocking_timeout=1):
        state = cache.get(state_key) or {
            'tokens': float(max_requests),
            'updated_at': now,
        }
        elapsed = max(0, now - float(state.get('updated_at', now)))
        tokens = min(
            float(max_requests),
            float(state.get('tokens', max_requests)) + (elapsed * refill_rate),
        )

        if tokens >= 1:
            cache.set(
                state_key,
                {
                    'tokens': tokens - 1,
                    'updated_at': now,
                },
                timeout=math.ceil(period_seconds * 2),
            )
            return GoogleServiceRateLimitResult(allowed=True)

        retry_after = (1 - tokens) / refill_rate
        cache.set(
            state_key,
            {
                'tokens': tokens,
                'updated_at': now,
            },
            timeout=math.ceil(period_seconds * 2),
        )
        return GoogleServiceRateLimitResult(
            allowed=False,
            retry_after=retry_after,
        )
