from __future__ import annotations

import jsonschema
from constance import config
from django.conf import settings
from django.db import models
from django.utils.translation import gettext as t

from kobo.apps.organizations.utils import get_real_owner
from kpi.exceptions import MailerError
from kpi.fields import KpiUidField
from kpi.models.abstract_models import AbstractTimeStampedModel
from kpi.utils.log import logging
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
        choices=InviteType,
        default=InviteType.USER_OWNERSHIP_TRANSFER,
        max_length=30,
    )
    metadata = models.JSONField(default=dict)
    METADATA_SCHEMA = {'type': 'object', 'additionalProperties': False}

    objects = InviteManager()
    all_objects = InviteAllManager()

    class Meta:
        verbose_name = 'invite'
        constraints = [
            models.UniqueConstraint(
                fields=['sender'],
                condition=models.Q(
                    invite_type=InviteType.ORG_OWNERSHIP_TRANSFER,
                    status=InviteStatusChoices.PENDING,
                ),
                name='unique_pending_org_ownership_transfer',
            ),
        ]

    def save(self, *args, **kwargs):
        if self.metadata is None:
            self.metadata = {}
        jsonschema.validate(self.metadata, self.METADATA_SCHEMA)
        super().save(*args, **kwargs)

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

        try:
            Mailer.send(email_message)
        except MailerError as e:
            logging.warning(
                f'Failed to send project ownership transfer acceptance email: {e}'
            )

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

        try:
            Mailer.send(email_message)
        except MailerError as e:
            logging.warning(
                f'Failed to send project ownership transfer invite email: {e}'
            )

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

        try:
            Mailer.send(email_message)
        except MailerError as e:
            logging.warning(
                f'Failed to send project ownership transfer refusal email: {e}'
            )


class OrgMembershipAutoInviteManager(models.Manager):

    def create(self, **kwargs):
        _ = kwargs.pop('status', InviteStatusChoices.ACCEPTED)
        return super().create(
            invite_type=InviteType.ORG_MEMBERSHIP,
            status=InviteStatusChoices.ACCEPTED,
            **kwargs,
        )

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


class OrgOwnershipTransferInviteManager(models.Manager):

    def create(self, **kwargs):
        billing_review_requested = kwargs.pop('billing_review_requested', False)
        metadata = kwargs.setdefault('metadata', {})
        if 'billing_review_requested' not in metadata:
            metadata['billing_review_requested'] = billing_review_requested
        return super().create(
            invite_type=InviteType.ORG_OWNERSHIP_TRANSFER, **kwargs
        )

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(invite_type=InviteType.ORG_OWNERSHIP_TRANSFER)
        )


class OrgOwnershipTransferInvite(Invite):
    METADATA_SCHEMA = {
        'type': 'object',
        'properties': {'billing_review_requested': {'type': 'boolean'}},
        'required': ['billing_review_requested'],
        'additionalProperties': False,
    }

    objects = OrgOwnershipTransferInviteManager()

    class Meta:
        proxy = True
        verbose_name = 'organization ownership transfer invite'

    def __str__(self) -> str:
        org_name = (
            self.sender.organization.name
            if hasattr(self.sender, 'organization') and self.sender.organization
            else ''
        )
        return (
            f'Ownership transfer for {org_name} '
            f'from {self.sender.username} to {self.recipient.username} '
            f'({self.status})'
        )

    @property
    def organization(self):
        return self.sender.organization

    @property
    def billing_review_requested(self) -> bool:
        if self.metadata is None:
            return False
        return self.metadata.get('billing_review_requested', False)

    @billing_review_requested.setter
    def billing_review_requested(self, value: bool):
        if self.metadata is None:
            self.metadata = {}
        self.metadata['billing_review_requested'] = bool(value)

    def send_invite_email(self):
        recipient_language = settings.LANGUAGE_CODE
        if hasattr(self.recipient, 'extra_details') and self.recipient.extra_details:
            recipient_language = self.recipient.extra_details.data.get(
                'last_ui_language', settings.LANGUAGE_CODE
            )

        org = self.organization
        accept_url = (
            f'{settings.KOBOFORM_URL}/#/projects/home'
            f'?organization_ownership_transfer={self.uid}'
            f'&organization_id={org.id}'
        )

        template_variables = {
            'new_owner_username': self.recipient.username,
            'current_owner_username': self.sender.username,
            'current_owner_email': self.sender.email,
            'team_name': org.name,
            'accept_url': accept_url,
            'billing_review_requested': self.billing_review_requested,
            'invite_expiry': config.PROJECT_OWNERSHIP_INVITE_EXPIRY,
        }

        email_message = EmailMessage(
            to=self.recipient.email,
            subject=t('Action required: KoboToolbox team ownership transfer request'),
            plain_text_content_or_template=(
                'emails/organization_ownership_transfer_request.txt'
            ),
            template_variables=template_variables,
            html_content_or_template=(
                'emails/organization_ownership_transfer_request.html'
            ),
            language=recipient_language,
        )

        try:
            Mailer.send(email_message)
        except MailerError as e:
            logging.warning(
                f'Failed to send organization ownership transfer request email: {e}'
            )

    def send_acceptance_email(self):
        pass

    def send_refusal_email(self):
        pass
