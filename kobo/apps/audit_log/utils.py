from dataclasses import dataclass
from math import inf

from django.conf import settings

from kobo.apps.organizations.constants import UsageType
from kobo.apps.stripe.utils.import_management import requires_stripe
from kobo.apps.stripe.utils.subscription_limits import (
    get_organization_subscription_limit,
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


@requires_stripe
def get_max_lookback_days(user, **kwargs) -> int:
    if is_user_anonymous(user):
        return 0
    user_org = user.organization
    limit = get_organization_subscription_limit(
        organization=user_org, usage_type=UsageType.LOG_LOOKBACK_DAYS
    )
    # this should only happen if the default subscription is missing a log lookback
    # limit for some reason, just default to the minimum lifespan of a log
    if limit == inf:
        return min(settings.ACCESS_LOG_LIFESPAN, settings.PROJECT_HISTORY_LOG_LIFESPAN)
    return int(limit)
