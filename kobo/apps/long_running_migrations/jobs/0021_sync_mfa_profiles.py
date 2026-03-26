from django.db import transaction

from kobo.apps.accounts.mfa.models import MfaMethodsWrapper
from kobo.apps.openrosa.apps.main.models import UserProfile

from kpi.utils.log import logging


def run():
    logging.info('[LRM 0021] - Starting MFA profile sync')

    # Evaluate query to a list to support cross-database subqueries
    active_mfa_user_ids = list(
        MfaMethodsWrapper.objects.filter(
            is_active=True
        ).values_list('user_id', flat=True)
    )

    with transaction.atomic():
        updated_true = UserProfile.objects.filter(
            is_mfa_active=False,
            user_id__in=active_mfa_user_ids
        ).update(is_mfa_active=True)

        updated_false = UserProfile.objects.filter(
            is_mfa_active=True
        ).exclude(
            user_id__in=active_mfa_user_ids
        ).update(is_mfa_active=False)

    logging.info(
        f'[LRM 0021] - Completed MFA profile sync. '
        f'Enabled: {updated_true}, Disabled: {updated_false}.'
    )
