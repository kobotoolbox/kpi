from datetime import timedelta

from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone
from django.utils.translation import gettext_noop as t

from kobo.apps.accounts.models import SocialAppCustomData, SocialAppManagedDomain
from kobo.apps.accounts.utils import (
    SOCIAL_APP_IDENTIFIER,
    remove_stale_managed_sso_reminders,
    users_needing_update,
)
from kobo.apps.help.models import InAppMessage, InAppMessageUsers, MessageType
from kobo.apps.kobo_auth.shortcuts import User
from kobo.celery import celery_app
from kpi.utils.log import logging

DEFAULT_IN_APP_MESSAGE_BODY = t(
    'Dear ##username##,\n\n'
    'Going forward, your organization will be managing all Kobo accounts '
    'through ##sso_name##. Please connect your ##sso_name## account. '
    'Your password will be disabled and you will be required to use ##sso_name## '
    'to log in.'
)


def update_linked_user(user: User, managed_provider_id: str):
    user.set_unusable_password()
    user.socialaccount_set.exclude(provider=managed_provider_id).delete()
    user.save()


def notify_unlinked_users(
    user_ids: list[int],
    managed_social_app: 'socialaccount.SocialApp',
    requesting_user: User = None,
    message_body: str = None,
):
    with transaction.atomic():
        # keeping this in a transaction means we don't have to worry later
        # that we've already created the message but not the recipients
        in_app_message = create_inapp_message(
            managed_social_app, requesting_user, body=message_body
        )
        logging.info(
            f'[Managed SSO] Creating in-app message for unregistered users for'
            f' managed social app {managed_social_app.name}.'
        )
        created = InAppMessageUsers.objects.bulk_create(
            [
                InAppMessageUsers(user_id=user_id, in_app_message=in_app_message)
                for user_id in user_ids
            ]
        )
        logging.info(
            f'[Managed SSO] Created {len(created)} notifications for'
            ' unregistered users for managed social '
            f'app {managed_social_app.name}'
        )


def create_inapp_message(social_app, requesting_user=None, body=None):
    title = t('Update your account')
    snippet = t('Please connect your ##sso_name## account')
    body = body or DEFAULT_IN_APP_MESSAGE_BODY
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


@celery_app.task()
def update_users(
    social_app_custom_data_id: int,
    domain: str,
    requesting_user_id: int = None,
    send_in_app_message: bool = True,
    in_app_message_body: str = None,
):
    # Only pks cross the task boundary: model instances are not JSON-serializable.
    # The flag and the domain are re-checked here because the admin can turn
    # managed off, drop the domain or delete the app before the worker runs.
    custom_data = (
        _managed_custom_data(social_app_custom_data_id, domain)
        .select_related('social_app')
        .first()
    )
    if custom_data is None:
        logging.info(
            f'[Managed SSO] Domain {domain} is no longer managed by social app'
            f' custom data {social_app_custom_data_id}. Nothing to do.'
        )
        return
    social_app = custom_data.social_app
    requesting_user = (
        User.objects.get(pk=requesting_user_id) if requesting_user_id else None
    )
    users_to_update = users_needing_update(social_app, domain)
    if not users_to_update.exists():
        logging.info(
            f'[Managed SSO] No users to update for social app'
            f' {social_app.name} with '
            f'domain {domain}. Nothing to do.'
        )
        return
    # The admin can also turn managed off while this task is running, so the
    # check is repeated before each destructive change.
    stopped_mid_run = (
        f'[Managed SSO] Domain {domain} stopped being managed by social app'
        f' {social_app.name} while updating users. Stopping.'
    )
    user_ids_needing_notification = []
    for user in users_to_update:
        # 'managed_account' is an annotated field created by the query
        if user.managed_account > 0:
            if not _managed_custom_data(social_app_custom_data_id, domain).exists():
                logging.info(stopped_mid_run)
                return
            logging.info(
                '[Managed SSO] Removing alternative login methods for user '
                f'{user.username} for managed social app {social_app.name}.'
            )
            update_linked_user(user, social_app.provider_id)
        else:
            user_ids_needing_notification.append(user.id)
    if user_ids_needing_notification:
        if not send_in_app_message:
            logging.info(
                '[Managed SSO] Skipping in-app notification for social app '
                f'{social_app.name} with domain {domain}.'
            )
            return
        if not _managed_custom_data(social_app_custom_data_id, domain).exists():
            logging.info(stopped_mid_run)
            return
        notify_unlinked_users(
            user_ids_needing_notification,
            social_app,
            requesting_user,
            message_body=in_app_message_body,
        )


@celery_app.task()
def managed_sso_sweep():
    remove_stale_managed_sso_reminders()
    managed_domains = SocialAppManagedDomain.objects.filter(
        social_app__managed=True
    ).values_list('social_app_id', 'domain')
    for social_app_custom_data_id, domain in managed_domains:
        # TODO: determine who kicked off the original update_users task and set them
        # as requesting_user
        update_users(social_app_custom_data_id, domain)


def _managed_custom_data(
    social_app_custom_data_id: int, domain: str
) -> QuerySet[SocialAppCustomData]:
    """
    The custom data, only while `domain` is one of its managed domains.
    """
    return SocialAppCustomData.objects.filter(
        pk=social_app_custom_data_id, managed=True, domains__domain=domain
    )
