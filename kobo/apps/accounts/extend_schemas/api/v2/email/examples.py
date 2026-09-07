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

def get_email_create_examples() -> list[OpenApiExample]:
    """
    What to send depends on how the request is authenticated, so show each
    variant rather than one payload carrying every field
    """
    return [
        OpenApiExample(
            'Browser session',
            value={'email': 'new@example.com'},
            description=(
                'Nothing else is needed: the session already carries the'
                ' re-authentication, provided it happened within'
                ' `ACCOUNT_REAUTHENTICATION_TIMEOUT`. If it did not, the'
                ' response is `403` listing the flows to complete first.'
            ),
            request_only=True,
        ),
        OpenApiExample(
            'Token or OAuth2 without MFA',
            value={
                'email': 'new@example.com',
                'current_password': '<current password>',
            },
            description=(
                'A stateless credential has no session to re-authenticate in,'
                ' so the current password proves the request instead. Required'
                ' whenever the account has a usable password.'
            ),
            request_only=True,
        ),
        OpenApiExample(
            'Token or OAuth2 with MFA enabled',
            value={
                'email': 'new@example.com',
                'current_password': '<current password>',
                'mfa_code': '<TOTP or recovery code>',
            },
            description=(
                'Accounts with MFA enabled must also send a code, either from'
                ' the authenticator app or one of the recovery codes. Note that'
                ' Basic authentication is refused outright for these accounts,'
                ' so this applies to token and OAuth2 callers.'
            ),
            request_only=True,
        ),
    ]
