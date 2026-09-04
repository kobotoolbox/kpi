from drf_spectacular.utils import OpenApiExample

from kobo.apps.accounts.constants import EMAIL_CONFIRMATION_REQUESTED_DETAIL


def get_email_confirmation_request_examples() -> list[OpenApiExample]:
    return [
        OpenApiExample(
            'Request accepted',
            value={'detail': str(EMAIL_CONFIRMATION_REQUESTED_DETAIL)},
            response_only=True,
        ),
    ]
