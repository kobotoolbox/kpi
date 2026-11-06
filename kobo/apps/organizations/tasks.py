from datetime import timedelta

from celery.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded
from celery.signals import task_failure
from constance import config
from django.apps import apps
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext as t
from more_itertools import chunked

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import OrganizationInviteStatusChoices
from kobo.apps.project_ownership.models import Transfer
from kobo.apps.project_ownership.utils import create_invite
from kobo.celery import celery_app
from kpi.exceptions import MailerError
from kpi.utils.log import logging
from kpi.utils.mailer import EmailMessage, Mailer


@celery_app.task(
    queue='kpi_low_priority_queue',
    soft_time_limit=settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT,
)
def transfer_member_data_ownership_to_org(user_id: int):
    sender = User.objects.get(pk=user_id)
    recipient = sender.organization.owner_user_object
    user_assets = (
        sender.assets.only('pk', 'uid')
        .exclude(
            pk__in=Transfer.objects.values_list('asset_id', flat=True).filter(
                invite__sender=sender, invite__recipient=recipient
            )
        )
        .iterator()
    )

    # Splitting assets into batches to avoid creating a long-running
    # Celery task that could exceed Celery's soft time limit or consume
    # too much RAM, potentially leading to termination by Kubernetes.
    for asset_batch in chunked(
        user_assets, settings.USER_ASSET_ORG_TRANSFER_BATCH_SIZE
    ):
        create_invite(
            sender=sender,
            recipient=recipient,
            assets=asset_batch,
            invite_class_name='OrgMembershipAutoInvite',
        )


@celery_app.task(
    autoretry_for=(
        SoftTimeLimitExceeded,
        TimeLimitExceeded,
    ),
    max_retries=5,
    retry_backoff=60,
    retry_jitter=False,
    queue='kpi_low_priority_queue',
    soft_time_limit=settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT,
)
def transfer_organization_ownership(transfer_id: int):
    OrganizationOwnershipTransfer = apps.get_model(
        'organizations', 'OrganizationOwnershipTransfer'
    )
    OrganizationOwner = apps.get_model('organizations', 'OrganizationOwner')
    OrganizationUser = apps.get_model('organizations', 'OrganizationUser')

    try:
        # Phase 1: Atomically swap OrganizationOwner and update outgoing
        # owner role to Admin in its own transaction so row locks are released
        # quickly and do not block concurrent requests.
        with transaction.atomic():
            transfer = (
                OrganizationOwnershipTransfer.objects.select_for_update()
                .select_related('organization', 'sender', 'recipient')
                .get(pk=transfer_id)
            )

            if transfer.status in (
                OrganizationInviteStatusChoices.COMPLETE,
                OrganizationInviteStatusChoices.CANCELLED,
                OrganizationInviteStatusChoices.DECLINED,
                OrganizationInviteStatusChoices.FAILED,
            ):
                logging.warning(
                    f'Transfer {transfer_id} is in status {transfer.status}; '
                    'skipping reassignment.'
                )
                return

            if transfer.status != OrganizationInviteStatusChoices.IN_PROGRESS:
                transfer.status = OrganizationInviteStatusChoices.IN_PROGRESS
                transfer.save(update_fields=['status', 'modified'])

            org_owner = OrganizationOwner.objects.select_for_update().get(
                organization=transfer.organization
            )
            new_org_user = OrganizationUser.objects.select_for_update().get(
                organization=transfer.organization,
                user=transfer.recipient,
            )
            if org_owner.organization_user_id != new_org_user.id:
                org_owner.organization_user = new_org_user
                org_owner.save(update_fields=['organization_user'])

            outgoing_org_user = OrganizationUser.objects.select_for_update().get(
                organization=transfer.organization,
                user=transfer.sender,
            )
            if not outgoing_org_user.is_admin:
                outgoing_org_user.is_admin = True
                outgoing_org_user.save(update_fields=['is_admin'])

        # Phase 2: Batch project transfers chunk by chunk. Each chunk commits
        # its own project transfers and immediately kicks off Celery tasks for
        # Mongo and S3 file moves. If the task is interrupted, .exclude()
        # ensures it picks up only the remaining assets without duplicating work.
        sender = transfer.sender
        recipient = transfer.recipient
        user_assets = (
            sender.assets.only('pk', 'uid')
            .exclude(
                pk__in=Transfer.objects.values_list('asset_id', flat=True).filter(
                    invite__sender=sender, invite__recipient=recipient
                )
            )
            .iterator()
        )

        for asset_batch in chunked(
            user_assets, settings.USER_ASSET_ORG_TRANSFER_BATCH_SIZE
        ):
            create_invite(
                sender=sender,
                recipient=recipient,
                assets=list(asset_batch),
                invite_class_name='OrgMembershipAutoInvite',
            )

        # Phase 3: Mark transfer as complete and trigger completion emails.
        with transaction.atomic():
            transfer = OrganizationOwnershipTransfer.objects.select_for_update().get(
                pk=transfer_id
            )
            transfer.status = OrganizationInviteStatusChoices.COMPLETE
            transfer.save(update_fields=['status', 'modified'])
            transaction.on_commit(transfer.send_completion_email)

    except Exception as e:
        logging.exception(
            f'Failed to execute organization ownership transfer {transfer_id}: {e}'
        )
        try:
            OrganizationOwnershipTransfer.objects.filter(pk=transfer_id).update(
                status=OrganizationInviteStatusChoices.FAILED,
                modified=timezone.now(),
            )
        except Exception as inner_e:
            logging.error(
                f'Could not set status to failed for transfer {transfer_id}: {inner_e}'
            )
        raise


@task_failure.connect(sender=transfer_organization_ownership)
def transfer_organization_ownership_failure(sender=None, **kwargs):
    OrganizationOwnershipTransfer = apps.get_model(
        'organizations', 'OrganizationOwnershipTransfer'
    )
    transfer_id = kwargs['args'][0]
    try:
        OrganizationOwnershipTransfer.objects.filter(pk=transfer_id).update(
            status=OrganizationInviteStatusChoices.FAILED,
            modified=timezone.now(),
        )
    except Exception as e:
        logging.error(
            f'Failed to mark transfer {transfer_id} as failed in task_failure: {e}'
        )


@celery_app.task
def mark_organization_invite_as_expired():
    Invite = apps.get_model('organizations', 'OrganizationInvitation')

    expiry_threshold = timezone.now() - timedelta(
        days=config.ORGANIZATION_INVITE_EXPIRY
    )

    invites_to_update = []
    for invite in Invite.objects.filter(
        created__lte=expiry_threshold,
        status=OrganizationInviteStatusChoices.PENDING,
    ):
        invite.status = OrganizationInviteStatusChoices.EXPIRED
        invites_to_update.append(invite)

    if not invites_to_update:
        return

    Invite.objects.bulk_update(invites_to_update, fields=['status'])
    email_messages = []

    for invite in invites_to_update:
        template_variables = {
            'username': invite.invited_by.username,
            'recipient': (
                invite.invitee.username if invite.invitee else invite.invitee_identifier
            ),
            'organization': invite.organization.name,
            'base_url': settings.KOBOFORM_URL,
        }
        email_messages.append(
            EmailMessage(
                to=invite.invited_by.email,
                subject=t('Organization invite has expired'),
                plain_text_content_or_template='emails/expired_org_invite.txt',
                template_variables=template_variables,
                html_content_or_template='emails/expired_org_invite.html',
                language=(invite.invited_by.extra_details.data.get('last_ui_language')),
            )
        )

    try:
        Mailer.send(email_messages)
    except MailerError as e:
        logging.warning(f'Failed to send expired organization invite emails: {e}')
