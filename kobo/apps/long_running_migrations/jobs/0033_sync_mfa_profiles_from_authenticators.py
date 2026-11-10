from kobo.apps.accounts.mfa.utils import sync_mfa_profiles
from kpi.utils.log import logging


def run():
    """
    Re-sync `UserProfile.is_mfa_active` now that allauth's `Authenticator`,
    not `MfaMethodsWrapper`, is the source of truth for MFA state
    """
    logging.info('[LRM 0033] - Starting MFA profile sync from authenticators')
    enabled, disabled = sync_mfa_profiles()
    logging.info(
        f'[LRM 0033] - Completed MFA profile sync. '
        f'Enabled: {enabled}, Disabled: {disabled}.'
    )
