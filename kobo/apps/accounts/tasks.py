from datetime import timedelta

from django.contrib.auth.hashers import UNUSABLE_PASSWORD_PREFIX
from django.db import transaction
from django.db.models import CharField, Count, F, Func, Q, Value
from django.db.models.functions import Lower
from django.utils import timezone
from django.utils.translation import gettext_noop as t

from kobo.apps.accounts.models import SocialAppCustomData, SocialAppManagedDomain
from kobo.apps.accounts.utils import SOCIAL_APP_IDENTIFIER, has_social_account
from kobo.apps.help.models import InAppMessage, InAppMessageUsers, MessageType
from kobo.apps.kobo_auth.shortcuts import User
from kobo.celery import celery_app
from kpi.utils.log import logging


class SplitPart(Func):
    function = 'SPLIT_PART'
    output_field = CharField()


def update_linked_user(user: User, managed_provider_id: str):
    user.set_unusable_password()
    user.socialaccount_set.exclude(provider=managed_provider_id).delete()
    user.save()


def notify_unlinked_users(
    user_ids: list[int],
    managed_social_app: 'socialaccount.SocialApp',
    requesting_user: User = None,
):
    with transaction.atomic():
        # keeping this in a transaction means we don't have to worry later
        # that we've already created the message but not the recipients
        in_app_message = create_inapp_message(managed_social_app, requesting_user)
        logging.info(
            f'[Managed SSO] Creating in-app message for unregistered users for'
            f' managed social app {managed_social_app.name}.'
        )
        InAppMessageUsers.objects.bulk_create(
            [
                InAppMessageUsers(user_id=user_id, in_app_message=in_app_message)
                for user_id in user_ids
            ]
        )


def create_inapp_message(social_app, requesting_user=None):
    title = t('Update your account')
    snippet = t('Please connect your ##sso_name## account')
    body = t(
        'Dear ##username##,\n\n'
        'Going forward, your organization will be managing all Kobo accounts '
        'through ##sso_name##. Please connect your ##sso_name## account. '
        'Your password will be disabled and you will be required to use ##sso_name## '
        'to log in.'
    )
    return InAppMessage.objects.create(
        #  … save raw strings into DB to let them be translated in
        # the users' language in the API response, i.e. when front end
        # exposes the message in the UI.
        title=title,
        snippet=snippet,
        body=body,
        published=True,
        valid_from=timezone.now(),
        valid_until=timezone.now() + timedelta(days=365),
        always_display_as_new=True,
        generic_related_objects={SOCIAL_APP_IDENTIFIER: social_app.pk},
        last_editor=requesting_user,
        message_type=MessageType.MANAGED_SSO_REMINDER,
    )


def users_needing_update(social_app_custom_data: SocialAppCustomData, domain: str):
    social_app = social_app_custom_data.social_app
    users_already_received_message = InAppMessageUsers.objects.filter(
        in_app_message__message_type=MessageType.MANAGED_SSO_REMINDER,
        in_app_message__generic_related_objects__contains={
            SOCIAL_APP_IDENTIFIER: social_app.pk,
        },
    ).values_list('user_id', flat=True)
    users = (
        User.objects.prefetch_related('socialaccount_set')
        .filter(extra_details__sso_exempt=False)
        .exclude(id__in=users_already_received_message)
        .annotate(
            domain=SplitPart(Lower(F('email')), Value('@'), Value(2)),
            managed_account=Count(
                'socialaccount',
                filter=Q(socialaccount__provider=social_app.provider_id),
            ),
            # TODO: why doesn't exclude work here?
            other_accounts=Count(
                'socialaccount',
                filter=~Q(socialaccount__provider=social_app.provider_id),
            ),
        )
        .filter(domain=domain)
        .exclude(
            password__startswith=UNUSABLE_PASSWORD_PREFIX,
            other_accounts=0,
            managed_account=1,
        )
    )
    return users


@celery_app.task()
def update_users(social_app_custom_data, domain, requesting_user=None):
    users_to_update = users_needing_update(social_app_custom_data, domain)
    social_app = social_app_custom_data.social_app
    if not users_to_update.exists():
        logging.info(
            f'[Managed SSO] No users to update for social app'
            f' {social_app.name} with '
            f'domain {domain}. Nothing to do.'
        )
    social_app = social_app_custom_data.social_app
    user_ids_needing_notification = []
    for user in users_to_update:
        if has_social_account(user, social_app):
            logging.info(
                '[Managed SSO] Removing alternative login methods for user'
                f'{user.username} for managed social app {social_app.name}.'
            )
            update_linked_user(user, social_app.provider_id)
        else:
            user_ids_needing_notification.append(user.id)
    if len(user_ids_needing_notification) > 0:
        notify_unlinked_users(
            user_ids_needing_notification, social_app, requesting_user
        )


@celery_app.task()
def managed_sso_sweep():
    managed_domains = SocialAppManagedDomain.objects.select_related(
        'social_app'
    ).filter(social_app__managed=True)
    for domain in managed_domains:
        # TODO: determine who kicked off the original update_users task and set them
        # as requesting_user
        update_users(domain.social_app, domain.domain)
