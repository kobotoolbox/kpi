from __future__ import annotations

from constance import config
from django.conf import settings
from django.db import models
from django.utils.translation import gettext as t

from kobo.apps.organizations.utils import get_real_owner
from kpi.fields import KpiUidField
from kpi.models.abstract_models import AbstractTimeStampedModel
from kpi.utils.mailer import EmailMessage, Mailer

from .choices import InviteStatusChoices


class InviteType(models.TextChoices):
    ORG_MEMBERSHIP = 'org-membership'
    ORG_OWNERSHIP_TRANSFER = 'org-ownership-transfer'
    USER_OWNERSHIP_TRANSFER = 'user-ownership-transfer'


class InviteAllManager(models.Manager):
    pass


class InviteManager(models.Manager):

    def create(self, **kwargs):
        return super().create(invite_type=InviteType.USER_OWNERSHIP_TRANSFER, **kwargs)

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(invite_type=InviteType.USER_OWNERSHIP_TRANSFER)
        )


class Invite(AbstractTimeStampedModel):

    uid = KpiUidField(uid_prefix='poi')
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='transfer_ownership_requests',
        on_delete=models.CASCADE,
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='transfer_ownership_responses',
        on_delete=models.CASCADE,
    )
    status = models.CharField(
        max_length=11,
        choices=InviteStatusChoices.choices,
        default=InviteStatusChoices.PENDING,
        db_index=True
    )
    invite_type = models.CharField(
        choices=InviteType.choices,
        default=InviteType.USER_OWNERSHIP_TRANSFER,
        max_length=30,
    )
    objects = InviteManager()
    all_objects = InviteAllManager()

    class Meta:
        verbose_name = 'invitation'

    def __str__(self):
        return (
            f'from {self.sender.username} to '
            f'{self.recipient.username} '
            f'({InviteStatusChoices(self.status)})'
        )

    @property
    def auto_accept_invites(self):
        return config.PROJECT_OWNERSHIP_AUTO_ACCEPT_INVITES

    def send_acceptance_email(self):

        template_variables = {
            'username': self.sender.username,
            'recipient': self.recipient.username,
            'transfers': [
                {
                    'asset_uid': transfer.asset.uid,
                    'asset_name': transfer.asset.name,
                }
                for transfer in self.transfers.all()
            ],
            'base_url': settings.KOBOFORM_URL,
        }

        email_message = EmailMessage(
            to=self.sender.email,
            subject=t('KoboToolbox project ownership transfer accepted'),
            plain_text_content_or_template='emails/accepted_invite.txt',
            template_variables=template_variables,
            html_content_or_template='emails/accepted_invite.html',
            language=self.recipient.extra_details.data.get('last_ui_language'),
        )

        Mailer.send(email_message)

    def send_invite_email(self):

        real_next_owner = get_real_owner(self.recipient)
        template_suffix = ''
        if real_next_owner != self.recipient:
            template_suffix = '_org'

        template_variables = {
            'username': self.recipient.username,
            'sender_username': self.sender.username,
            'sender_email': self.sender.email,
            'transfers': [
                {
                    'asset_uid': transfer.asset.uid,
                    'asset_name': transfer.asset.name,
                }
                for transfer in self.transfers.all()
            ],
            'base_url': settings.KOBOFORM_URL,
            'invite_expiry': config.PROJECT_OWNERSHIP_INVITE_EXPIRY,
            'invite_uid': self.uid,
        }

        email_message = EmailMessage(
            to=self.recipient.email,
            subject=t(
                'Action required: KoboToolbox project ownership transfer request'
            ),
            plain_text_content_or_template=f'emails/new_invite{template_suffix}.txt',
            template_variables=template_variables,
            html_content_or_template=f'emails/new_invite{template_suffix}.html',
            language=self.recipient.extra_details.data.get('last_ui_language'),
        )

        Mailer.send(email_message)

    def send_refusal_email(self):

        template_variables = {
            'username': self.sender.username,
            'recipient': self.recipient.username,
            'transfers': [
                {
                    'asset_uid': transfer.asset.uid,
                    'asset_name': transfer.asset.name,
                }
                for transfer in self.transfers.all()
            ],
            'base_url': settings.KOBOFORM_URL,
        }

        email_message = EmailMessage(
            to=self.sender.email,
            subject=t('KoboToolbox project ownership transfer incomplete'),
            plain_text_content_or_template='emails/declined_invite.txt',
            template_variables=template_variables,
            html_content_or_template='emails/declined_invite.html',
            language=self.recipient.extra_details.data.get('last_ui_language'),
        )

        Mailer.send(email_message)


class OrgMembershipAutoInviteManager(models.Manager):

    def create(self, **kwargs):
        return super().create(invite_type=InviteType.ORG_MEMBERSHIP, **kwargs)

    def get_queryset(self):
        return super().get_queryset().filter(invite_type=InviteType.ORG_MEMBERSHIP)


class OrgMembershipAutoInvite(Invite):

    class Meta:
        proxy = True
        verbose_name = 'auto-invite for user project transfer to organization'

    objects = OrgMembershipAutoInviteManager()

    @property
    def auto_accept_invites(self):
        return True

    def send_acceptance_email(self):
        pass

    def send_invite_email(self):
        pass

    def send_refusal_email(self):
        pass
