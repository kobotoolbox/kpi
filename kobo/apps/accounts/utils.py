from django.contrib.auth.models import User

from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES


def user_has_inactive_paid_subscription(username):
    return (
        User.objects.filter(
            username=username,
            organizations_organization__djstripe_customers__subscriptions__items__price__unit_amount__gt=0,
        )
        .exclude(
            organizations_organization__djstripe_customers__subscriptions__status__in=ACTIVE_STRIPE_STATUSES,
        )
        .exists()
    )


def user_has_paid_subscription(username):
    return User.objects.filter(
        username=username,
        organizations_organization__djstripe_customers__subscriptions__status__in=ACTIVE_STRIPE_STATUSES,
        organizations_organization__djstripe_customers__subscriptions__items__price__unit_amount__gt=0,
    ).exists()
