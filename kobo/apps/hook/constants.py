# coding: utf-8
from enum import Enum

from rest_framework import status

HOOK_LOG_FAILED = 0
HOOK_LOG_PENDING = 1
HOOK_LOG_SUCCESS = 2


class HookLogStatus(Enum):
    FAILED = HOOK_LOG_FAILED
    PENDING = HOOK_LOG_PENDING
    SUCCESS = HOOK_LOG_SUCCESS


KOBO_INTERNAL_ERROR_STATUS_CODE = None

SUBMISSION_PLACEHOLDER = '%SUBMISSION%'

# Status codes that trigger a retry
RETRIABLE_STATUS_CODES = [
    # status.HTTP_429_TOO_MANY_REQUESTS,
    status.HTTP_502_BAD_GATEWAY,
    status.HTTP_503_SERVICE_UNAVAILABLE,
    status.HTTP_504_GATEWAY_TIMEOUT,
]
