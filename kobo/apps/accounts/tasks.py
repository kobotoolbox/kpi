from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone

from kobo.apps.accounts.models import SocialAppCustomData, SocialAppManagedDomain
from kobo.apps.accounts.utils import (
    remove_stale_managed_sso_reminders,
    update_or_create_in_app_message,
    users_needing_update,
)
from kobo.apps.help.models import InAppMessageUsers
from kobo.apps.kobo_auth.shortcuts import User
from kobo.celery import celery_app
from kpi.utils.log import logging


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
    """
    Add `user_ids` as recipients of the social app's single reminder, which is
    created or refreshed with `message_body` on the way.

    The reminder is kept even with no recipient, expired, so a user who later
    loses their SSO exemption gets the message the admin chose.
    """
    with transaction.atomic():
        # keeping this in a transaction means we don't have to worry later
        # that we've already created the message but not the recipients, and
        # that a recipient-less message is never visible to everyone
        in_app_message = update_or_create_in_app_message(
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
        if not in_app_message.inappmessageusers_set.exists():
            in_app_message.valid_until = timezone.now()
            in_app_message.save(update_fields=['valid_until'])


@celery_app.task()
def update_users(
    social_app_custom_data_id: int,
    domain: str,
    requesting_user_id: int = None,
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
    if not users_to_update.exists() and not custom_data.send_in_app_message:
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
    if not custom_data.send_in_app_message:
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
        message_body=custom_data.in_app_message_body,
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
