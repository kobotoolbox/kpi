from allauth.socialaccount.models import SocialAccount
from django.conf import settings

from kobo.apps.accounts.models import SocialAppManagedDomain
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES


def user_has_inactive_paid_subscription(username):
    if not settings.STRIPE_ENABLED:
        return False

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
    if not settings.STRIPE_ENABLED:
        return False

    return User.objects.filter(
        username=username,
        organizations_organization__djstripe_customers__subscriptions__status__in=ACTIVE_STRIPE_STATUSES,
        organizations_organization__djstripe_customers__subscriptions__items__price__unit_amount__gt=0,
    ).exists()


def get_normalized_domain(email):
    _, separator, domain = email.rpartition('@')
    if not separator:
        return ''
    return domain.strip().lower()


def user_is_managed_by_sso(user):
    email = user.email
    domain = get_normalized_domain(email)
    managed_social_app = SocialAppManagedDomain.objects.filter(
        domain__iexact=domain
    ).first()
    if getattr(user, 'extra_details', None) and user.extra_details.sso_exempt:
        return False

    if managed_social_app:
        provider_id = managed_social_app.social_app.social_app.provider_id
        user_has_social_account = SocialAccount.objects.filter(
            provider=provider_id, user=user
        ).exists()
        return user_has_social_account
    return False
