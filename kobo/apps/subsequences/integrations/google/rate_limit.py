from __future__ import annotations

import math
from datetime import timezone as datetime_timezone
from email.utils import parsedate_to_datetime

from django.conf import settings
from django.utils import timezone


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
