from unittest.mock import patch

from constance import config
from ddt import data, ddt, unpack
from django.contrib.admin.sites import AdminSite
from django.core import mail
from django.db import IntegrityError
from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.admin.organization_owner import OrgOwnerAdmin
from kobo.apps.organizations.constants import (
    OWNERSHIP_TRANSFER_ALREADY_PENDING_ERROR,
    RECIPIENT_AMBIGUOUS_EMAIL_ERROR,
    RECIPIENT_MUST_BE_ADMIN_ERROR,
)
from kobo.apps.organizations.models import OrganizationOwner
from kobo.apps.organizations.tests.test_organizations_api import (
    BaseOrganizationAssetApiTestCase,
)
from kobo.apps.project_ownership.models import (
    InviteStatusChoices,
    OrgOwnershipTransferInvite,
)
from kpi.exceptions import MailerError
from kpi.urls.router_api_v2 import URL_NAMESPACE
from kpi.utils.placeholders import replace_placeholders


class BaseOrganizationOwnershipTransferTestCase(BaseOrganizationAssetApiTestCase):
    fixtures = ['test_data']
    URL_NAMESPACE = URL_NAMESPACE

    def setUp(self):
        super().setUp()
        self.organization = self.someuser.organization
        self.owner_user = self.someuser
        self.admin_user = self.anotheruser
        self.member_user = self.alice
        self.external_user = self.bob

        self.list_url = reverse(
            self._get_endpoint('organization-ownership-transfers-list'),
            kwargs={'uid_organization': self.organization.id},
        )

    def _create_transfer(
        self,
        sender,
        recipient_identifier,
        billing_review_requested=False,
    ):
        self.client.force_login(sender)
        payload = {
            'recipient': recipient_identifier,
            'billing_review_requested': billing_review_requested,
        }
        return self.client.post(self.list_url, data=payload)


@ddt
class OrganizationOwnershipTransferTestCase(BaseOrganizationOwnershipTransferTestCase):

    @data(
        ('owner', status.HTTP_201_CREATED),
        ('admin', status.HTTP_403_FORBIDDEN),
        ('member', status.HTTP_403_FORBIDDEN),
        ('external', status.HTTP_404_NOT_FOUND),
    )
    @unpack
    def test_user_can_initiate_transfer_permission(self, user_role, expected_status):
        """
        Only the current organization owner can initiate ownership transfer.
        Admins and members receive 403, external users receive 404.
        """
        user = getattr(self, f'{user_role}_user')
        response = self._create_transfer(user, self.admin_user.username)
        self.assertEqual(response.status_code, expected_status)

        if expected_status == status.HTTP_201_CREATED:
            self.assertEqual(OrgOwnershipTransferInvite.objects.count(), 1)
            transfer = OrgOwnershipTransferInvite.objects.first()
            self.assertEqual(transfer.organization, self.organization)
            self.assertEqual(transfer.sender, self.owner_user)
            self.assertEqual(transfer.recipient, self.admin_user)
            self.assertEqual(transfer.status, InviteStatusChoices.PENDING)
            self.assertFalse(transfer.billing_review_requested)
            self.assertIn('uid', response.data)
            self.assertEqual(response.data['uid'], transfer.uid)
            self.assertEqual(response.data['recipient'], self.admin_user.username)

    def test_recipient_must_be_active_admin_in_same_team(self):
        """
        Recipient must be an active admin within the same organization.
        Non-admins, owners, external users, and non-existent users all return
        the same generic error to prevent user enumeration.
        """
        # Regular member in same organization
        response = self._create_transfer(self.owner_user, self.member_user.username)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('recipient', response.data)
        self.assertEqual(
            str(response.data['recipient'][0]),
            str(RECIPIENT_MUST_BE_ADMIN_ERROR),
        )

        # Owner themselves
        response = self._create_transfer(self.owner_user, self.owner_user.username)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('recipient', response.data)
        self.assertEqual(
            str(response.data['recipient'][0]),
            str(RECIPIENT_MUST_BE_ADMIN_ERROR),
        )

        # External user
        response = self._create_transfer(self.owner_user, self.external_user.username)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('recipient', response.data)
        self.assertEqual(
            str(response.data['recipient'][0]),
            str(RECIPIENT_MUST_BE_ADMIN_ERROR),
        )

        # Non-existent user
        response = self._create_transfer(self.owner_user, 'non_existent_username')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('recipient', response.data)
        self.assertEqual(
            str(response.data['recipient'][0]),
            str(RECIPIENT_MUST_BE_ADMIN_ERROR),
        )

    def test_recipient_cannot_be_inactive_admin(self):
        """
        An inactive admin cannot be the transfer recipient.
        """
        self.admin_user.is_active = False
        self.admin_user.save(update_fields=['is_active'])

        response = self._create_transfer(self.owner_user, self.admin_user.username)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('recipient', response.data)
        self.assertEqual(
            str(response.data['recipient'][0]),
            str(RECIPIENT_MUST_BE_ADMIN_ERROR),
        )

    def test_non_mmo_organization_cannot_initiate_transfer(self):
        """
        Non-MMO organizations (such as personal default organizations)
        reject ownership transfers with 404 Not Found.
        """
        self.organization.mmo_override = False
        self.organization.save(update_fields=['mmo_override'])

        response = self._create_transfer(self.owner_user, self.admin_user.username)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_recipient_can_be_identified_by_email(self):
        """
        Recipient can be specified by email address of the active admin.
        """
        response = self._create_transfer(self.owner_user, self.admin_user.email)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        transfer = OrgOwnershipTransferInvite.objects.first()
        self.assertEqual(transfer.recipient, self.admin_user)

    def test_recipient_can_be_identified_by_mixed_case_email(self):
        """
        Recipient email match is case-insensitive.
        """
        response = self._create_transfer(self.owner_user, self.admin_user.email.upper())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        transfer = OrgOwnershipTransferInvite.objects.first()
        self.assertEqual(transfer.recipient, self.admin_user)

    def test_recipient_email_resolves_team_admin_when_shared_with_external_user(
        self,
    ):
        """
        When an external user shares the same email with a team admin,
        email lookup resolves to the team admin and succeeds.
        """
        self.external_user.email = self.admin_user.email
        self.external_user.save(update_fields=['email'])

        response = self._create_transfer(self.owner_user, self.admin_user.email)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        transfer = OrgOwnershipTransferInvite.objects.first()
        self.assertEqual(transfer.recipient, self.admin_user)

    def test_recipient_ambiguous_email_returns_400(self):
        """
        When multiple active admins in the same team share an email,
        reject the ambiguous match with a 400 error.
        """
        second_admin = User.objects.create(
            username='second_admin',
            email=self.admin_user.email,
            is_active=True,
        )
        self.organization.add_user(second_admin, is_admin=True)

        response = self._create_transfer(self.owner_user, self.admin_user.email)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('recipient', response.data)
        expected_error = replace_placeholders(
            RECIPIENT_AMBIGUOUS_EMAIL_ERROR,
            email=self.admin_user.email,
        )
        self.assertEqual(str(response.data['recipient'][0]), str(expected_error))

    def test_only_one_ownership_transfer_can_be_pending_per_team(self):
        """
        Enforce business rule: only one pending ownership transfer per team.
        """
        # First transfer succeeds
        response1 = self._create_transfer(self.owner_user, self.admin_user.username)
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)

        # Second transfer fails while first is pending
        response2 = self._create_transfer(self.owner_user, self.admin_user.username)
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response2.data)
        self.assertEqual(
            str(response2.data['detail'][0]),
            str(OWNERSHIP_TRANSFER_ALREADY_PENDING_ERROR),
        )

        # Resolve first transfer (e.g. declined), then can create another
        transfer = OrgOwnershipTransferInvite.objects.first()
        transfer.status = InviteStatusChoices.DECLINED
        transfer.save(update_fields=['status'])

        response3 = self._create_transfer(self.owner_user, self.admin_user.username)
        self.assertEqual(response3.status_code, status.HTTP_201_CREATED)

    def test_reassigning_owner_cancels_pending_transfer(self):
        """
        When the organization owner is changed in OrgOwnerAdmin, any pending
        ownership transfer initiated by the old owner is automatically cancelled,
        and the new owner is able to initiate a new transfer.
        """
        response1 = self._create_transfer(self.owner_user, self.admin_user.username)
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        old_transfer = OrgOwnershipTransferInvite.objects.first()
        self.assertEqual(old_transfer.status, InviteStatusChoices.PENDING)

        # Simulate OrgOwnerAdmin saving the new owner
        owner_admin = OrgOwnerAdmin(OrganizationOwner, AdminSite())
        owner_record = self.organization.owner
        new_owner_org_user = self.organization.organization_users.get(
            user=self.admin_user
        )
        owner_record.organization_user = new_owner_org_user

        request = self.client.request().wsgi_request
        owner_admin.save_model(request, owner_record, form=None, change=True)

        old_transfer.refresh_from_db()
        self.assertEqual(old_transfer.status, InviteStatusChoices.CANCELLED)

        # Create a second admin to be recipient for the new owner
        second_admin = User.objects.create(
            username='second_admin',
            email='second_admin@example.com',
            is_active=True,
        )
        self.organization.add_user(second_admin, is_admin=True)

        # New owner can now initiate transfer
        self.client.force_login(self.admin_user)
        response2 = self.client.post(
            self.list_url,
            data={'recipient': second_admin.username},
        )
        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)

    def test_billing_review_requested_flag(self):
        """
        billing_review_requested boolean flag is persisted on the model
        and renders the billing review notice in the notification email.
        """
        response = self._create_transfer(
            self.owner_user,
            self.admin_user.username,
            billing_review_requested=True,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['billing_review_requested'])

        transfer = OrgOwnershipTransferInvite.objects.first()
        self.assertTrue(transfer.billing_review_requested)

        self.assertEqual(len(mail.outbox), 1)
        sent_email = mail.outbox[0]
        billing_notice = (
            'The current owner has requested that you review and confirm the '
            "team's billing details upon accepting this transfer."
        )
        self.assertIn(billing_notice, sent_email.body)
        if sent_email.alternatives:
            html_content = sent_email.alternatives[0][0]
            self.assertIn(billing_notice, html_content)

    def test_email_notification_dispatched(self):
        """
        Email is dispatched to recipient with correct template variables
        and accept link.
        """
        response = self._create_transfer(self.owner_user, self.admin_user.username)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.assertEqual(len(mail.outbox), 1)
        sent_email = mail.outbox[0]
        self.assertEqual(sent_email.to, [self.admin_user.email])
        self.assertIn(
            'Action required: KoboToolbox team ownership transfer request',
            sent_email.subject,
        )

        transfer = OrgOwnershipTransferInvite.objects.first()
        expected_param = f'organization_ownership_transfer={transfer.uid}'
        expected_org_param = f'organization_id={self.organization.id}'

        billing_notice = (
            'The current owner has requested that you review and confirm the '
            "team's billing details upon accepting this transfer."
        )

        expected_expiry_notice = (
            'This transfer request will expire in '
            f'{config.PROJECT_OWNERSHIP_INVITE_EXPIRY} days.'
        )

        # Check plaintext body
        self.assertIn(self.admin_user.username, sent_email.body)
        self.assertIn(self.owner_user.username, sent_email.body)
        self.assertIn(self.organization.name, sent_email.body)
        self.assertIn(expected_param, sent_email.body)
        self.assertIn(expected_org_param, sent_email.body)
        self.assertIn(expected_expiry_notice, sent_email.body)
        self.assertNotIn(billing_notice, sent_email.body)

        # Check HTML alternative if present
        if sent_email.alternatives:
            html_content = sent_email.alternatives[0][0]
            self.assertIn(expected_param, html_content)
            self.assertIn(expected_org_param, html_content)
            self.assertIn(expected_expiry_notice, html_content)
            self.assertNotIn(billing_notice, html_content)

    def test_mailer_error_does_not_prevent_transfer_creation(self):
        """
        A failure in sending the email is logged and does not fail the API call.
        """
        with patch(
            'kobo.apps.project_ownership.models.invite.Mailer.send',
            side_effect=MailerError('SMTP connection error'),
        ):
            response = self._create_transfer(self.owner_user, self.admin_user.username)
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            self.assertEqual(OrgOwnershipTransferInvite.objects.count(), 1)

    def test_simultaneous_transfers_conflict_returns_400(self):
        """
        If a concurrent request creates a transfer causing an IntegrityError,
        return 400 with OWNERSHIP_TRANSFER_ALREADY_PENDING_ERROR instead of 500.
        """
        with patch.object(
            OrgOwnershipTransferInvite.objects,
            'create',
            side_effect=IntegrityError('unique_pending_org_ownership_transfer'),
        ):
            response = self._create_transfer(self.owner_user, self.admin_user.username)
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn('detail', response.data)
            self.assertEqual(
                str(response.data['detail'][0]),
                str(OWNERSHIP_TRANSFER_ALREADY_PENDING_ERROR),
            )

    def test_unrelated_integrity_error_is_reraised(self):
        """
        IntegrityErrors other than the unique pending transfer constraint
        are re-raised rather than converted to validation errors.
        """
        with patch.object(
            OrgOwnershipTransferInvite.objects,
            'create',
            side_effect=IntegrityError('some_other_constraint_violation'),
        ):
            with self.assertRaises(IntegrityError):
                self._create_transfer(self.owner_user, self.admin_user.username)
