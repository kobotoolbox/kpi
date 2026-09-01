from allauth.socialaccount.models import SocialAccount, SocialApp
from django.conf import settings
from django.db import models
from django.db.models import Func, Value
from django.db.models.functions import Lower

from kobo.apps.accounts.models import SocialAppManagedDomain
from kobo.apps.help.models import InAppMessage, InAppMessageUsers, MessageType
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


def get_managed_sso_track_1_queryset(social_app):
    """
    Queryset for Track 1 accounts:
    Accounts linked to social_app, excluding SSO-exempt and anonymous users.
    """
    provider_id = social_app.provider_id or social_app.provider
    return (
        User.objects.filter(socialaccount__provider=provider_id)
        .exclude(extra_details__sso_exempt=True)
        .exclude(pk=settings.ANONYMOUS_USER_ID)
        .distinct()
    )


def get_managed_sso_track_2_queryset(social_app, domains):
    """
    Queryset for Track 2 accounts:
    Unlinked accounts with email domain in `domains` (index-backed), excluding
    anonymous users and users already notified via InAppMessageUsers for this
    social_app (idempotence).
    """
    if not domains:
        return User.objects.none()

    provider_id = social_app.provider_id or social_app.provider
    social_app_key = f'{SocialApp._meta.app_label}.{SocialApp._meta.model_name}'

    domain_expr = Func(
        Lower('email'),
        Value('@'),
        Value(2),
        function='split_part',
        output_field=models.CharField(),
    )
    try:
        existing_in_app_message_ids = list(
            InAppMessage.objects.filter(
                message_type=MessageType.MANAGED_SSO_REMINDER,
                generic_related_objects__contains={social_app_key: social_app.pk},
            ).values_list('id', flat=True)
        )
    except Exception:
        existing_in_app_message_ids = [
            iam.id
            for iam in InAppMessage.objects.filter(
                message_type=MessageType.MANAGED_SSO_REMINDER
            )
            if isinstance(iam.generic_related_objects, dict)
            and iam.generic_related_objects.get(social_app_key) == social_app.pk
        ]

    already_notified_user_ids = InAppMessageUsers.objects.filter(
        in_app_message_id__in=existing_in_app_message_ids
    ).values_list('user_id', flat=True)

    return (
        User.objects.annotate(email_domain=domain_expr)
        .filter(email_domain__in=list(domains))
        .exclude(socialaccount__provider=provider_id)
        .exclude(pk=settings.ANONYMOUS_USER_ID)
        .exclude(id__in=already_notified_user_ids)
        .distinct()
    )
