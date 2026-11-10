from kobo.apps.accounts.mfa.utils import sync_mfa_profiles
from kpi.utils.log import logging


def run():
    logging.info('[LRM 0022] - Starting MFA profile sync')
    enabled, disabled = sync_mfa_profiles()
    logging.info(
        f'[LRM 0022] - Completed MFA profile sync. '
        f'Enabled: {enabled}, Disabled: {disabled}.'
    )
