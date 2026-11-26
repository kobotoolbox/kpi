from unittest.mock import patch

import pytest
from django.core.cache import cache
from django.test import override_settings
from freezegun import freeze_time

from kobo.apps.subsequences.exceptions import ServiceQuotaExceededError
from kobo.apps.subsequences.integrations.rate_limit import (
    ServiceRateLimitExceeded,
    acquire_service_quota,
    require_service_quota,
)

QUOTA_NAME = 'test_quota'
RATE_LIMITS = {QUOTA_NAME: {'max_requests': 2, 'period_seconds': 60}}


@pytest.fixture(autouse=True)
def clear_quota_state():
    cache.delete(f'nlp-service-quota:{QUOTA_NAME}:bucket')
    yield
    cache.delete(f'nlp-service-quota:{QUOTA_NAME}:bucket')


@override_settings(NLP_SERVICE_RATE_LIMITS=RATE_LIMITS)
def test_unknown_quota_is_always_allowed():
    for _ in range(5):
        assert acquire_service_quota('not_configured').allowed


@override_settings(
    NLP_SERVICE_RATE_LIMITS={QUOTA_NAME: {'max_requests': 0, 'period_seconds': 60}}
)
def test_non_positive_limit_disables_the_quota():
    for _ in range(5):
        assert acquire_service_quota(QUOTA_NAME).allowed


@override_settings(NLP_SERVICE_RATE_LIMITS=RATE_LIMITS)
def test_request_is_denied_once_the_bucket_is_empty():
    with freeze_time('2026-01-01 00:00:00'):
        assert acquire_service_quota(QUOTA_NAME).allowed
        assert acquire_service_quota(QUOTA_NAME).allowed

        result = acquire_service_quota(QUOTA_NAME)

    assert not result.allowed
    # 2 requests per 60 seconds = 1 token every 30 seconds
    assert result.retry_after == pytest.approx(30)


@override_settings(NLP_SERVICE_RATE_LIMITS=RATE_LIMITS)
def test_bucket_refills_over_time():
    with freeze_time('2026-01-01 00:00:00') as frozen_time:
        assert acquire_service_quota(QUOTA_NAME).allowed
        assert acquire_service_quota(QUOTA_NAME).allowed
        assert not acquire_service_quota(QUOTA_NAME).allowed

        frozen_time.tick(30)

        assert acquire_service_quota(QUOTA_NAME).allowed
        assert not acquire_service_quota(QUOTA_NAME).allowed


@override_settings(NLP_SERVICE_RATE_LIMITS=RATE_LIMITS)
def test_require_service_quota_raises_with_retry_after():
    with freeze_time('2026-01-01 00:00:00'):
        require_service_quota(QUOTA_NAME)
        require_service_quota(QUOTA_NAME)

        with pytest.raises(ServiceRateLimitExceeded) as exc_info:
            require_service_quota(QUOTA_NAME)

    # Celery retries on the parent class, with `retry_after` as countdown
    assert isinstance(exc_info.value, ServiceQuotaExceededError)
    assert exc_info.value.retry_after == 30
    assert exc_info.value.quota_name == QUOTA_NAME


@override_settings(NLP_SERVICE_RATE_LIMITS=RATE_LIMITS)
def test_request_is_allowed_when_the_cache_fails():
    with patch(
        'kobo.apps.subsequences.integrations.rate_limit.cache.lock',
        side_effect=ConnectionError,
    ):
        for _ in range(5):
            assert acquire_service_quota(QUOTA_NAME).allowed
