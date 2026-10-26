from unittest.mock import patch

from ddt import data, ddt, unpack
from django.core import mail
from django.db import IntegrityError
from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.constants import (
    OWNERSHIP_TRANSFER_ALREADY_PENDING_ERROR,
    RECIPIENT_AMBIGUOUS_EMAIL_ERROR,
    RECIPIENT_CANNOT_BE_OWNER_ERROR,
    RECIPIENT_MUST_BE_ADMIN_ERROR,
)
from kobo.apps.organizations.models import (
    OrganizationInviteStatusChoices,
    OrganizationOwnershipTransfer,
)
from kobo.apps.organizations.tests.test_organizations_api import (
    BaseOrganizationAssetApiTestCase,
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
            self.assertEqual(OrganizationOwnershipTransfer.objects.count(), 1)
            transfer = OrganizationOwnershipTransfer.objects.first()
            self.assertEqual(transfer.organization, self.organization)
            self.assertEqual(transfer.sender, self.owner_user)
            self.assertEqual(transfer.recipient, self.admin_user)
            self.assertEqual(transfer.status, OrganizationInviteStatusChoices.PENDING)
            self.assertFalse(transfer.billing_review_requested)

    def test_recipient_must_be_active_admin_in_same_team(self):
        """
        Recipient must be an active admin within the same organization.
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
            str(RECIPIENT_CANNOT_BE_OWNER_ERROR),
        )

        # External user
        response = self._create_transfer(self.owner_user, self.external_user.username)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('recipient', response.data)

        # Non-existent user
        response = self._create_transfer(self.owner_user, 'non_existent_username')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('recipient', response.data)

    def test_recipient_cannot_be_inactive_admin(self):
        """
        An inactive admin cannot be the transfer recipient.
        """
        self.admin_user.is_active = False
        self.admin_user.save(update_fields=['is_active'])

        response = self._create_transfer(self.owner_user, self.admin_user.username)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('recipient', response.data)

    def test_recipient_can_be_identified_by_email(self):
        """
        Recipient can be specified by email address of the active admin.
        """
        response = self._create_transfer(self.owner_user, self.admin_user.email)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        transfer = OrganizationOwnershipTransfer.objects.first()
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
        transfer = OrganizationOwnershipTransfer.objects.first()
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
        transfer = OrganizationOwnershipTransfer.objects.first()
        transfer.status = OrganizationInviteStatusChoices.DECLINED
        transfer.save(update_fields=['status'])

        response3 = self._create_transfer(self.owner_user, self.admin_user.username)
        self.assertEqual(response3.status_code, status.HTTP_201_CREATED)

    def test_billing_review_requested_flag(self):
        """
        billing_review_requested boolean flag is persisted on the model.
        """
        response = self._create_transfer(
            self.owner_user,
            self.admin_user.username,
            billing_review_requested=True,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['billing_review_requested'])

        transfer = OrganizationOwnershipTransfer.objects.first()
        self.assertTrue(transfer.billing_review_requested)

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

        transfer = OrganizationOwnershipTransfer.objects.first()
        expected_param = f'organization_ownership_transfer={transfer.guid}'
        expected_org_param = f'organization_id={self.organization.id}'

        # Check plaintext body
        self.assertIn(self.admin_user.username, sent_email.body)
        self.assertIn(self.owner_user.username, sent_email.body)
        self.assertIn(self.organization.name, sent_email.body)
        self.assertIn(expected_param, sent_email.body)
        self.assertIn(expected_org_param, sent_email.body)

        # Check HTML alternative if present
        if sent_email.alternatives:
            html_content = sent_email.alternatives[0][0]
            self.assertIn(expected_param, html_content)
            self.assertIn(expected_org_param, html_content)

    def test_mailer_error_does_not_prevent_transfer_creation(self):
        """
        A failure in sending the email is logged and does not fail the API call.
        """
        with patch(
            'kobo.apps.organizations.models.Mailer.send',
            side_effect=MailerError('SMTP connection error'),
        ):
            response = self._create_transfer(self.owner_user, self.admin_user.username)
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            self.assertEqual(OrganizationOwnershipTransfer.objects.count(), 1)

    def test_simultaneous_transfers_conflict_returns_400(self):
        """
        If a concurrent request creates a transfer causing an IntegrityError,
        return 400 with OWNERSHIP_TRANSFER_ALREADY_PENDING_ERROR instead of 500.
        """
        with patch.object(
            OrganizationOwnershipTransfer.objects,
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
