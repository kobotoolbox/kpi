from datetime import timedelta

from django.db.models import Q, QuerySet
from django.utils.timezone import now

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import XForm


def get_inactive_users(days: int = 365) -> QuerySet:
    """
    Retrieve users who have been inactive for a specified number of days.

    A user is considered inactive if:
    - They have not logged in within the given period (or never logged in).
    - They have not modified or created an XForm within the given period.
    - They have not modified or have a submission within the given period.

    :param days: int: Number of days to determine inactivity (default: 365 days)

    :return: A queryset of inactive users
    """
    # Calculate the user inactivity threshold date
    inactivity_threshold = now() - timedelta(days=days)

    # Identify users who have not logged in within the given period
    inactive_users = User.objects.filter(
        Q(last_login__lt=inactivity_threshold) | Q(last_login__isnull=True)
    )

    # Find users who have active forms or submissions within the given period
    active_users = XForm.objects.filter(
        Q(date_modified__gt=inactivity_threshold) |
        Q(date_created__gt=inactivity_threshold) |
        Q(instances__date_modified__gt=inactivity_threshold) |
        Q(instances__date_created__gt=inactivity_threshold)
    ).values_list('user', flat=True).distinct()

    # Exclude active users from the inactive list
    return inactive_users.exclude(id__in=active_users)
