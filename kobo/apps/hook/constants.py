from rest_framework import status

KOBO_INTERNAL_ERROR_STATUS_CODE = None

SUBMISSION_PLACEHOLDER = '%SUBMISSION%'

# Status codes that trigger a retry
RETRIABLE_STATUS_CODES = [
    # status.HTTP_429_TOO_MANY_REQUESTS,
    status.HTTP_502_BAD_GATEWAY,
    status.HTTP_503_SERVICE_UNAVAILABLE,
    status.HTTP_504_GATEWAY_TIMEOUT,
]
