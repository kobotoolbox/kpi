from allauth.socialaccount.models import SocialAccount, SocialApp
from django.conf import settings
from django.contrib.auth.hashers import UNUSABLE_PASSWORD_PREFIX
from django.db.models import CharField, Count, F, Func, Q, Value
from django.db.models.functions import Lower

from kobo.apps.accounts.models import SocialAppManagedDomain
from kobo.apps.help.models import InAppMessageUsers, MessageType
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.stripe.constants import ACTIVE_STRIPE_STATUSES

# Key used in InAppMessage.generic_related_objects, same convention as
# the transfer identifier in kobo.apps.help.serializers
SOCIAL_APP_IDENTIFIER = f'{SocialApp._meta.app_label}.{SocialApp._meta.model_name}'


class SplitPart(Func):
    function = 'SPLIT_PART'
    output_field = CharField()


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


def users_needing_update(social_app: 'socialaccount.SocialApp', domain: str):
    users_already_received_message = InAppMessageUsers.objects.filter(
        in_app_message__message_type=MessageType.MANAGED_SSO_REMINDER,
        in_app_message__generic_related_objects__contains={
            SOCIAL_APP_IDENTIFIER: social_app.pk,
        },
    ).values_list('user_id', flat=True)
    users = (
        User.objects.exclude(extra_details__sso_exempt=True)
        .exclude(id__in=users_already_received_message)
        .annotate(
            domain=SplitPart(Lower(F('email')), Value('@'), Value(2)),
            managed_account=Count(
                'socialaccount',
                filter=Q(socialaccount__provider=social_app.provider_id),
            ),
            # `.exclude(socialaccount__provider=...)` would drop every user who
            # has *any* account on the managed provider; a filtered Count is
            # the only way to count the other accounts.
            other_accounts=Count(
                'socialaccount',
                filter=~Q(socialaccount__provider=social_app.provider_id),
            ),
        )
        .filter(domain=domain)
        .exclude(
            password__startswith=UNUSABLE_PASSWORD_PREFIX,
            other_accounts=0,
            managed_account__gte=1,
        )
    )
    return users
