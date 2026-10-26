from django.utils.translation import gettext_lazy as t

EMAIL_CONFIRMATION_REQUESTED_DETAIL = t(
    'If that email address needs confirming, a new confirmation email has been '
    'sent to it.'
)

SCIM_PROVISIONING_TIMEOUT = 60  # seconds
SCIM_PROVISIONING_POLL_INTERVAL = 10  # seconds
