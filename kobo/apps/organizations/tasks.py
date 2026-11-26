from datetime import timedelta

from celery.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded
from celery.signals import task_failure
from constance import config
from django.apps import apps
from django.conf import settings
from django.db import transaction
from django.db.models import Exists, OuterRef
from django.utils import timezone
from django.utils.translation import gettext as t
from more_itertools import chunked

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import OrganizationInviteStatusChoices
from kobo.apps.project_ownership.exceptions import TransferAlreadyProcessedException
from kobo.apps.project_ownership.models import (
    InviteStatusChoices,
    Transfer,
    TransferStatusChoices,
    TransferStatusTypeChoices,
)
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


MAX_OWNERSHIP_TRANSFER_RESTARTS = 5


@celery_app.task(
    autoretry_for=(
        SoftTimeLimitExceeded,
        TimeLimitExceeded,
    ),
    max_retries=MAX_OWNERSHIP_TRANSFER_RESTARTS,
    retry_backoff=60,
    retry_jitter=False,
    queue='kpi_low_priority_queue',
    soft_time_limit=settings.CELERY_LONG_RUNNING_TASK_SOFT_TIME_LIMIT,
    time_limit=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT,
)
def transfer_organization_ownership(transfer_id: int):
    OrgOwnershipTransferInvite = apps.get_model(
        'project_ownership', 'OrgOwnershipTransferInvite'
    )
    OrganizationOwner = apps.get_model('organizations', 'OrganizationOwner')
    OrganizationUser = apps.get_model('organizations', 'OrganizationUser')

    try:
        # Phase 1: Atomically swap OrganizationOwner and update outgoing
        # owner role to Admin in its own transaction so row locks are released
        # quickly and do not block concurrent requests.
        # Resolve the organization ID before locking so we can lock in strict
        # order: OrganizationOwner -> OrgOwnershipTransferInvite -> OrganizationUser.
        metadata = OrgOwnershipTransferInvite.objects.values_list(
            'metadata', flat=True
        ).get(pk=transfer_id)
        org_id = metadata.get('organization_id') if metadata else None

        with transaction.atomic():
            org_owner = (
                OrganizationOwner.objects.select_for_update()
                .select_related('organization_user')
                .filter(organization_id=org_id)
                .first()
                if org_id
                else None
            )

            transfer = (
                OrgOwnershipTransferInvite.objects.select_for_update()
                .select_related('sender', 'recipient')
                .get(pk=transfer_id)
            )

            if transfer.status in (
                InviteStatusChoices.COMPLETE,
                InviteStatusChoices.CANCELLED,
                InviteStatusChoices.DECLINED,
                InviteStatusChoices.EXPIRED,
                InviteStatusChoices.FAILED,
            ):
                logging.warning(
                    f'Transfer {transfer_id} is in status {transfer.status}; '
                    'skipping reassignment.'
                )
                return

            if not org_id or not org_owner:
                logging.error(f'Organization not found for transfer {transfer_id}')
                transfer.status = InviteStatusChoices.FAILED
                transfer.save(update_fields=['status', 'date_modified'])
                return

            new_org_user = (
                OrganizationUser.objects.select_for_update()
                .select_related('user')
                .get(
                    organization_id=org_id,
                    user=transfer.recipient,
                )
            )

            is_retry = transfer.status == InviteStatusChoices.IN_PROGRESS
            if (
                not is_retry
                and org_owner.organization_user.user_id != transfer.sender_id
            ) or (
                is_retry
                and org_owner.organization_user_id != new_org_user.id
                and org_owner.organization_user.user_id != transfer.sender_id
            ):
                logging.warning(
                    f'Transfer {transfer_id} is stale: sender {transfer.sender_id} '
                    f'is no longer the owner of organization {org_id}.'
                )
                transfer.status = InviteStatusChoices.FAILED
                transfer.save(update_fields=['status', 'date_modified'])
                return

            if not is_retry and (
                not new_org_user.is_admin or not new_org_user.user.is_active
            ):
                logging.warning(
                    f'Transfer {transfer_id} is invalid: recipient '
                    f'{transfer.recipient_id} is no longer an active admin of '
                    f'organization {org_id}.'
                )
                transfer.status = InviteStatusChoices.FAILED
                transfer.save(update_fields=['status', 'date_modified'])
                return

            if not is_retry:
                transfer.status = InviteStatusChoices.IN_PROGRESS
                transfer.save(update_fields=['status', 'date_modified'])

            if org_owner.organization_user_id != new_org_user.id:
                org_owner.organization_user = new_org_user
                org_owner.save(update_fields=['organization_user'])

                outgoing_org_user = OrganizationUser.objects.select_for_update().get(
                    organization_id=org_id,
                    user=transfer.sender,
                )
                if not outgoing_org_user.is_admin:
                    outgoing_org_user.is_admin = True
                    outgoing_org_user.save(update_fields=['is_admin'])

        # Phase 2: First resume any PENDING project transfers left behind by a
        # previous attempt that timed out mid-batch after create_invite()
        # committed the batch's Transfer rows.
        sender = transfer.sender
        recipient = transfer.recipient
        batch_size = settings.USER_ASSET_ORG_TRANSFER_BATCH_SIZE

        last_pending_pk = 0
        while True:
            pending_batch = list(
                Transfer.objects.filter(
                    pk__gt=last_pending_pk,
                    invite__sender=sender,
                    invite__recipient=recipient,
                    date_created__gte=transfer.date_created,
                    statuses__status_type=TransferStatusTypeChoices.GLOBAL,
                    statuses__status=TransferStatusChoices.PENDING,
                )
                .select_related(
                    'invite', 'invite__sender', 'invite__recipient', 'asset'
                )
                .defer('asset__content')
                .order_by('pk')[:batch_size]
            )
            if not pending_batch:
                break

            last_pending_pk = pending_batch[-1].pk
            for pending_transfer in pending_batch:
                try:
                    pending_transfer.transfer_project()
                except TransferAlreadyProcessedException:
                    logging.info(
                        f'Project transfer {pending_transfer.pk} for '
                        f'organization transfer {transfer_id} was already '
                        'processed; skipping.'
                    )
            OrgOwnershipTransferInvite.objects.filter(pk=transfer_id).update(
                date_modified=timezone.now()
            )

        # Then batch remaining assets using keyset pagination so memory stays
        # bounded for large collections and no server-side cursor is held
        # across create_invite() commits. NOT EXISTS scoped to this transfer's
        # creation timestamp ensures retries pick up only remaining assets
        # without skipping assets from prior transfer cycles.
        already_attempted = Transfer.objects.filter(
            asset_id=OuterRef('pk'),
            invite__sender=sender,
            invite__recipient=recipient,
            date_created__gte=transfer.date_created,
        )
        last_pk = 0

        while True:
            asset_batch = list(
                sender.assets.only('pk', 'uid')
                .filter(pk__gt=last_pk)
                .exclude(Exists(already_attempted))
                .order_by('pk')[:batch_size]
            )
            if not asset_batch:
                break

            last_pk = asset_batch[-1].pk
            create_invite(
                sender=sender,
                recipient=recipient,
                assets=asset_batch,
                invite_class_name='OrgMembershipAutoInvite',
            )
            # Heartbeat so the periodic restarter knows this transfer is still
            # actively progressing through a large project collection.
            OrgOwnershipTransferInvite.objects.filter(pk=transfer_id).update(
                date_modified=timezone.now()
            )

        # Phase 3: Check batch results, then mark transfer as complete or failed.
        has_failed_transfers = Transfer.objects.filter(
            invite__sender=sender,
            invite__recipient=recipient,
            date_created__gte=transfer.date_created,
            statuses__status=TransferStatusChoices.FAILED,
        ).exists()

        with transaction.atomic():
            transfer = (
                OrgOwnershipTransferInvite.objects.select_for_update(of=('self',))
                .select_related('sender__extra_details', 'recipient__extra_details')
                .get(pk=transfer_id)
            )
            if has_failed_transfers:
                logging.error(
                    f'Organization ownership transfer {transfer_id} completed '
                    'with one or more failed project transfers.'
                )
                transfer.status = InviteStatusChoices.FAILED
                transfer.save(update_fields=['status', 'date_modified'])
            else:
                transfer.status = InviteStatusChoices.COMPLETE
                transfer.save(update_fields=['status', 'date_modified'])
                transaction.on_commit(transfer.send_completion_email)

    except (SoftTimeLimitExceeded, TimeLimitExceeded):
        logging.warning(
            f'Organization ownership transfer {transfer_id} hit time limit; retrying.'
        )
        raise
    except Exception as e:
        logging.exception(
            f'Failed to execute organization ownership transfer {transfer_id}: {e}'
        )
        try:
            OrgOwnershipTransferInvite.objects.filter(pk=transfer_id).update(
                status=InviteStatusChoices.FAILED,
                date_modified=timezone.now(),
            )
        except Exception as inner_e:
            logging.error(
                f'Could not set status to failed for transfer {transfer_id}: {inner_e}'
            )
        raise


@task_failure.connect(sender=transfer_organization_ownership)
def transfer_organization_ownership_failure(sender=None, **kwargs):
    OrgOwnershipTransferInvite = apps.get_model(
        'project_ownership', 'OrgOwnershipTransferInvite'
    )
    transfer_id = kwargs['args'][0]
    try:
        OrgOwnershipTransferInvite.objects.filter(pk=transfer_id).exclude(
            status=InviteStatusChoices.FAILED
        ).update(
            status=InviteStatusChoices.FAILED,
            date_modified=timezone.now(),
        )
    except Exception as e:
        logging.error(
            f'Failed to mark transfer {transfer_id} as failed in task_failure: {e}'
        )


@celery_app.task
def restart_stuck_org_ownership_transfers():
    """
    Re-queue organization ownership transfers stuck in ACCEPTED or IN_PROGRESS
    (e.g. due to a lost Celery message or OOM-killed worker), and mark them
    FAILED once restart attempts are exhausted so teams are never blocked
    indefinitely.
    """
    OrgOwnershipTransferInvite = apps.get_model(
        'project_ownership', 'OrgOwnershipTransferInvite'
    )
    stuck_threshold = timezone.now() - timedelta(
        seconds=settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT + 60 * 5
    )

    stuck_pks = list(
        OrgOwnershipTransferInvite.objects.filter(
            status__in=(
                InviteStatusChoices.ACCEPTED,
                InviteStatusChoices.IN_PROGRESS,
            ),
            date_modified__lte=stuck_threshold,
        )
        .order_by('date_modified')
        .values_list('pk', flat=True)[: settings.MAX_RESTARTED_TRANSFERS]
    )

    for transfer_pk in stuck_pks:
        with transaction.atomic():
            transfer = (
                OrgOwnershipTransferInvite.objects.select_for_update(skip_locked=True)
                .filter(
                    pk=transfer_pk,
                    status__in=(
                        InviteStatusChoices.ACCEPTED,
                        InviteStatusChoices.IN_PROGRESS,
                    ),
                    date_modified__lte=stuck_threshold,
                )
                .first()
            )
            if not transfer:
                continue

            restart_count = transfer.metadata.get('restart_count', 0)
            if restart_count >= MAX_OWNERSHIP_TRANSFER_RESTARTS:
                logging.error(
                    f'Organization ownership transfer {transfer.pk} stuck after '
                    f'{restart_count} restarts; marking as failed.'
                )
                transfer.status = InviteStatusChoices.FAILED
                transfer.save(update_fields=['status', 'date_modified'])
                continue

            transfer.metadata['restart_count'] = restart_count + 1
            transfer.save(update_fields=['metadata', 'date_modified'])
            transaction.on_commit(
                lambda pk=transfer.pk: transfer_organization_ownership.delay(pk)
            )


@celery_app.task
def mark_organization_invite_as_expired():
    Invite = apps.get_model('organizations', 'OrganizationInvitation')
    OrgOwnershipTransferInvite = apps.get_model(
        'project_ownership', 'OrgOwnershipTransferInvite'
    )

    transfer_expiry_threshold = timezone.now() - timedelta(
        days=config.PROJECT_OWNERSHIP_INVITE_EXPIRY
    )
    OrgOwnershipTransferInvite.objects.filter(
        date_created__lte=transfer_expiry_threshold,
        status=InviteStatusChoices.PENDING,
    ).update(
        status=InviteStatusChoices.EXPIRED,
        date_modified=timezone.now(),
    )

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
