from django.utils.translation import gettext_lazy as t

# The login and registration screens show at most this many SSO buttons
MAX_DISPLAYED_SSO_PROVIDERS = 3

EMAIL_CONFIRMATION_REQUESTED_DETAIL = t(
    'If that email address needs confirming, a new confirmation email has been '
    'sent to it.'
)
