from datetime import timedelta

from constance import config
from django.apps import apps
from django.conf import settings
from django.utils import timezone
from django.utils.translation import gettext as t
from more_itertools import chunked

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import OrganizationInviteStatusChoices
from kobo.apps.project_ownership.models import Transfer
from kobo.apps.project_ownership.utils import create_invite
from kobo.celery import celery_app
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
                invite.invitee.username
                if invite.invitee
                else invite.invitee_identifier
            ),
            'organization': invite.organization.name,
            'base_url': settings.KOBOFORM_URL,
        }
        email_messages.append(
            EmailMessage(
                to=invite.invited_by.email,
                subject=t('Organization invite has expired'),
                plain_text_content_or_template='emails/expired_invite.txt',
                template_variables=template_variables,
                html_content_or_template='emails/expired_invite.html',
                language=(
                    invite.invited_by.extra_details.data.get('last_ui_language')
                )
            )
        )

    Mailer.send(email_messages)
