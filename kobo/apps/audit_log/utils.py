from dataclasses import dataclass
from datetime import timedelta

from django.utils import timezone

from kobo.apps.organizations.constants import UsageType
from kobo.apps.stripe.utils.subscription_limits import (
    get_limit_key,
    get_organizations_effective_limits,
)
from kpi.utils.permissions import is_user_anonymous


@dataclass
class SubmissionUpdate:
    id: int
    action: str
    root_uuid: str
    username: str = 'AnonymousUser'
    status: str | None = None

    def __post_init__(self):
        self.username = 'AnonymousUser' if self.username is None else self.username


def get_lookback_date(user):
    lookback_days = get_max_lookback_days(user)
    now = timezone.now()
    now_midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    min_date = now_midnight - timedelta(days=lookback_days)
    return min_date


def get_max_lookback_days(user, **kwargs) -> int:
    if is_user_anonymous(user):
        return 0
    user_org = user.organization
    limits = get_organizations_effective_limits(
        [user_org], include_onetime_addons=False, include_storage_addons=False
    )[user_org.id]
    limit = limits[get_limit_key(UsageType.LOG_LOOKBACK_DAYS)]
    return int(limit)
