from __future__ import annotations

import math
import time
from dataclasses import dataclass

from django.conf import settings
from django.core.cache import cache

from kobo.apps.subsequences.exceptions import ServiceQuotaExceededError
from kpi.utils.log import logging


@dataclass(frozen=True)
class ServiceRateLimitResult:
    allowed: bool
    retry_after: float = 0


class ServiceRateLimitExceeded(ServiceQuotaExceededError):
    """
    Raised before starting an NLP service request that would exceed shared quota
    """

    def __init__(self, quota_name: str, retry_after: float):
        self.quota_name = quota_name
        retry_after_seconds = max(1, math.ceil(retry_after))
        super().__init__(retry_after_seconds)
        self.args = (
            f'Service quota "{quota_name}" exhausted. '
            f'Retry after {retry_after_seconds} seconds.',
        )


def acquire_service_quota(quota_name: str) -> ServiceRateLimitResult:
    """
    Checks whether an NLP service request can be made without exceeding
    configured quota limits

    Uses Redis to count requests across all running server workers.
    Returns an object stating whether the request is 'allowed' right now,
    along with a 'retry_after' countdown timer if we are moving too fast.
    """
    config = settings.NLP_SERVICE_RATE_LIMITS.get(quota_name)
    if not config:
        return ServiceRateLimitResult(allowed=True)

    max_requests = config['max_requests']
    period_seconds = config['period_seconds']
    if max_requests <= 0:
        return ServiceRateLimitResult(allowed=True)

    try:
        return _acquire_token_bucket_quota(
            quota_name,
            max_requests,
            period_seconds,
        )
    except Exception:
        logging.exception(
            f'Service quota token bucket failed; allowing request: {quota_name=}'
        )
        return ServiceRateLimitResult(allowed=True)


def require_service_quota(quota_name: str) -> None:
    result = acquire_service_quota(quota_name)
    if not result.allowed:
        raise ServiceRateLimitExceeded(quota_name, result.retry_after)


def _acquire_token_bucket_quota(
    quota_name: str,
    max_requests: int,
    period_seconds: float,
) -> ServiceRateLimitResult:
    """
    Implements a distributed Token Bucket rate-limiter

    A bucket starts with `max_requests` tokens and refills at a constant rate
    over `period_seconds`. Each request consumes one token. If the bucket is
    empty, the request is denied, and we calculate exactly how many seconds
    until the next token will be available.
    """
    now = time.time()
    state_key = f'nlp-service-quota:{quota_name}:bucket'
    lock_key = f'nlp-service-quota:{quota_name}:lock'
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
            return ServiceRateLimitResult(allowed=True)

        retry_after = (1 - tokens) / refill_rate
        cache.set(
            state_key,
            {
                'tokens': tokens,
                'updated_at': now,
            },
            timeout=math.ceil(period_seconds * 2),
        )
        return ServiceRateLimitResult(
            allowed=False,
            retry_after=retry_after,
        )
