from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES


def user_has_paid_subscription(username):
    return (
        User.objects.filter(
            organizations_organization__djstripe_customers__subscriptions__status__in=ACTIVE_STRIPE_STATUSES,
        )
        .exclude(
            organizations_organization__djstripe_customers__subscriptions__items__price__unit_amount=0
        )
        .exists()
    )
