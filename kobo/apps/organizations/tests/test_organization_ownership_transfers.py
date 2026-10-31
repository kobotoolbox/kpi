from datetime import timedelta
from unittest.mock import patch

from constance.test import override_config
from ddt import data, ddt, unpack
from django.conf import settings
from django.core import mail
from django.db import IntegrityError
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.constants import (
    CANNOT_CHANGE_OWNER_ROLE_ERROR,
    CANNOT_REMOVE_OWNER_ERROR,
    INVITE_ALREADY_ACCEPTED_ERROR,
    INVITE_CANNOT_BE_RESENT_ERROR,
    OWNERSHIP_TRANSFER_ALREADY_PENDING_ERROR,
    PENDING_TRANSFER_ACCOUNT_DELETION_ERROR,
    PENDING_TRANSFER_MEMBER_REMOVAL_ERROR,
    PENDING_TRANSFER_ROLE_LOCKED_ERROR,
    RECIPIENT_AMBIGUOUS_EMAIL_ERROR,
    RECIPIENT_CANNOT_BE_OWNER_ERROR,
    RECIPIENT_MUST_BE_ADMIN_ERROR,
    TRANSFER_NOT_PENDING_ERROR,
)
from kobo.apps.organizations.models import (
    OrganizationInviteStatusChoices,
    OrganizationOwnershipTransfer,
    OrganizationUser,
)
from kobo.apps.organizations.serializers import (
    OrganizationOwnershipTransferSerializer,
    OrganizationUserSerializer,
)
from kobo.apps.organizations.tests.test_organizations_api import (
    BaseOrganizationAssetApiTestCase,
)
from kobo.apps.organizations.views import OrganizationOwnershipTransferViewSet
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

    def _get_detail_url(self, guid):
        return reverse(
            self._get_endpoint('organization-ownership-transfers-detail'),
            kwargs={'uid_organization': self.organization.id, 'guid': guid},
        )

    def _get_action_url(self, action_name, guid):
        return reverse(
            self._get_endpoint(f'organization-ownership-transfers-{action_name}'),
            kwargs={'uid_organization': self.organization.id, 'guid': guid},
        )


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

        transfer = OrganizationOwnershipTransfer.objects.first()
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

        transfer = OrganizationOwnershipTransfer.objects.first()
        expected_param = f'organization_ownership_transfer={transfer.guid}'
        expected_org_param = f'organization_id={self.organization.id}'

        billing_notice = (
            "The current owner has requested that you review and confirm the "
            "team's billing details upon accepting this transfer."
        )

        # Check plaintext body
        self.assertIn(self.admin_user.username, sent_email.body)
        self.assertIn(self.owner_user.username, sent_email.body)
        self.assertIn(self.organization.name, sent_email.body)
        self.assertIn(expected_param, sent_email.body)
        self.assertIn(expected_org_param, sent_email.body)
        self.assertNotIn(billing_notice, sent_email.body)

        # Check HTML alternative if present
        if sent_email.alternatives:
            html_content = sent_email.alternatives[0][0]
            self.assertIn(expected_param, html_content)
            self.assertIn(expected_org_param, html_content)
            self.assertNotIn(billing_notice, html_content)

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

    def test_members_endpoint_includes_pending_transfer_object(self):
        """
        GET /members/ and GET /members/{username}/ expose the nested
        `pending_transfer` object (including `guid`) for the recipient Admin,
        and `None` for all other members and invited rows.
        """
        members_list_url = reverse(
            self._get_endpoint('organization-members-list'),
            kwargs={'uid_organization': self.organization.id},
        )
        admin_detail_url = reverse(
            self._get_endpoint('organization-members-detail'),
            kwargs={
                'uid_organization': self.organization.id,
                'username': self.admin_user.username,
            },
        )
        self.client.force_login(self.owner_user)

        # Before any transfer is created
        res_before = self.client.get(members_list_url)
        self.assertEqual(res_before.status_code, status.HTTP_200_OK)
        for member in res_before.data['results']:
            self.assertIsNone(member['pending_transfer'])

        # Create ownership transfer to admin with billing review requested
        create_res = self._create_transfer(
            self.owner_user,
            self.admin_user.username,
            billing_review_requested=True,
        )
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        transfer = OrganizationOwnershipTransfer.objects.first()

        # List endpoint after transfer is created
        res_after = self.client.get(members_list_url)
        self.assertEqual(res_after.status_code, status.HTTP_200_OK)

        admin_row = next(
            m
            for m in res_after.data['results']
            if m.get('user__username') == self.admin_user.username
        )
        self.assertIsNotNone(admin_row['pending_transfer'])
        self.assertEqual(admin_row['pending_transfer']['guid'], str(transfer.guid))
        self.assertEqual(
            admin_row['pending_transfer']['status'],
            OrganizationInviteStatusChoices.PENDING,
        )
        self.assertTrue(admin_row['pending_transfer']['billing_review_requested'])

        owner_row = next(
            m
            for m in res_after.data['results']
            if m.get('user__username') == self.owner_user.username
        )
        self.assertIsNone(owner_row['pending_transfer'])

        # Detail endpoint also includes pending_transfer
        detail_res = self.client.get(admin_detail_url)
        self.assertEqual(detail_res.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(detail_res.data['pending_transfer'])
        self.assertEqual(
            detail_res.data['pending_transfer']['guid'], str(transfer.guid)
        )

        # Recipient Admin can also see pending_transfer
        self.client.force_login(self.admin_user)
        res_recipient = self.client.get(members_list_url)
        self.assertEqual(res_recipient.status_code, status.HTTP_200_OK)
        admin_row_rec = next(
            m
            for m in res_recipient.data['results']
            if m.get('user__username') == self.admin_user.username
        )
        self.assertIsNotNone(admin_row_rec['pending_transfer'])

        # Regular member cannot see pending_transfer (None)
        self.client.force_login(self.member_user)
        res_member = self.client.get(members_list_url)
        self.assertEqual(res_member.status_code, status.HTTP_200_OK)
        admin_row_mem = next(
            m
            for m in res_member.data['results']
            if m.get('user__username') == self.admin_user.username
        )
        self.assertIsNone(admin_row_mem['pending_transfer'])

        # Unrelated admin cannot see pending_transfer (None)
        unrelated_admin = User.objects.create_user(
            username='unrelated_admin', email='unrelated_admin@example.com'
        )
        OrganizationUser.objects.create(
            organization=self.organization, user=unrelated_admin, is_admin=True
        )
        self.client.force_login(unrelated_admin)
        res_unrelated = self.client.get(members_list_url)
        self.assertEqual(res_unrelated.status_code, status.HTTP_200_OK)
        admin_row_unrel = next(
            m
            for m in res_unrelated.data['results']
            if m.get('user__username') == self.admin_user.username
        )
        self.assertIsNone(admin_row_unrel['pending_transfer'])

    def test_organization_exposes_has_pending_ownership_transfer_flag(self):
        """
        GET /organizations/{uid_organization}/ exposes
        `has_pending_ownership_transfer` reflecting active transfer state.
        """
        org_detail_url = reverse(
            self._get_endpoint('organizations-detail'),
            kwargs={'uid_organization': self.organization.id},
        )
        self.client.force_login(self.owner_user)

        res_before = self.client.get(org_detail_url)
        self.assertEqual(res_before.status_code, status.HTTP_200_OK)
        self.assertFalse(res_before.data['has_pending_ownership_transfer'])

        create_res = self._create_transfer(self.owner_user, self.admin_user.username)
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)

        res_pending = self.client.get(org_detail_url)
        self.assertEqual(res_pending.status_code, status.HTTP_200_OK)
        self.assertTrue(res_pending.data['has_pending_ownership_transfer'])

        transfer = OrganizationOwnershipTransfer.objects.first()
        transfer.status = OrganizationInviteStatusChoices.CANCELLED
        transfer.save(update_fields=['status'])

        res_resolved = self.client.get(org_detail_url)
        self.assertEqual(res_resolved.status_code, status.HTTP_200_OK)
        self.assertFalse(res_resolved.data['has_pending_ownership_transfer'])

    def test_pending_transfer_locks_recipient_role_and_owner_role(self):
        """
        While a transfer is pending, the recipient Admin's role cannot be
        changed, and the Owner's role can never be changed via PATCH.
        """
        admin_detail_url = reverse(
            self._get_endpoint('organization-members-detail'),
            kwargs={
                'uid_organization': self.organization.id,
                'username': self.admin_user.username,
            },
        )
        owner_detail_url = reverse(
            self._get_endpoint('organization-members-detail'),
            kwargs={
                'uid_organization': self.organization.id,
                'username': self.owner_user.username,
            },
        )
        self._create_transfer(self.owner_user, self.admin_user.username)
        self.client.force_login(self.owner_user)

        # Cannot demote pending owner to member
        res = self.client.patch(admin_detail_url, data={'role': 'member'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            str(res.data['detail']), str(PENDING_TRANSFER_ROLE_LOCKED_ERROR)
        )

        # Cannot change owner role
        owner_res = self.client.patch(owner_detail_url, data={'role': 'admin'})
        self.assertEqual(owner_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            str(owner_res.data['detail']), str(CANNOT_CHANGE_OWNER_ROLE_ERROR)
        )

        # Once transfer resolves, admin role can be changed
        transfer = OrganizationOwnershipTransfer.objects.first()
        transfer.status = OrganizationInviteStatusChoices.DECLINED
        transfer.save(update_fields=['status'])

        res_after = self.client.patch(admin_detail_url, data={'role': 'member'})
        self.assertEqual(res_after.status_code, status.HTTP_200_OK)

    def test_pending_transfer_blocks_member_removal_and_owner_removal(self):
        """
        While a transfer is pending, the recipient Admin cannot be removed from
        the organization, and the Owner cannot be removed.
        """
        admin_detail_url = reverse(
            self._get_endpoint('organization-members-detail'),
            kwargs={
                'uid_organization': self.organization.id,
                'username': self.admin_user.username,
            },
        )
        owner_detail_url = reverse(
            self._get_endpoint('organization-members-detail'),
            kwargs={
                'uid_organization': self.organization.id,
                'username': self.owner_user.username,
            },
        )
        self._create_transfer(self.owner_user, self.admin_user.username)
        self.client.force_login(self.owner_user)

        # Cannot remove pending owner
        res = self.client.delete(admin_detail_url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            str(res.data['detail']), str(PENDING_TRANSFER_MEMBER_REMOVAL_ERROR)
        )

        # Cannot remove organization owner
        owner_res = self.client.delete(owner_detail_url)
        self.assertEqual(owner_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(str(owner_res.data['detail']), str(CANNOT_REMOVE_OWNER_ERROR))

        # Once transfer resolves, admin can be removed
        transfer = OrganizationOwnershipTransfer.objects.first()
        transfer.status = OrganizationInviteStatusChoices.CANCELLED
        transfer.save(update_fields=['status'])

        res_after = self.client.delete(admin_detail_url)
        self.assertEqual(res_after.status_code, status.HTTP_204_NO_CONTENT)

    @override_config(ALLOW_SELF_ACCOUNT_DELETION=True)
    def test_pending_transfer_blocks_account_deletion(self):
        """
        Neither the outgoing Owner nor the recipient Admin can delete their
        account while an ownership transfer is pending.
        """
        me_url = reverse('currentuser-detail')
        self._create_transfer(self.owner_user, self.admin_user.username)

        # Outgoing owner cannot delete account
        self.client.force_login(self.owner_user)
        owner_res = self.client.delete(
            me_url,
            data={'confirm': self.owner_user.extra_details.uid},
            format='json',
        )
        self.assertEqual(owner_res.status_code, status.HTTP_403_FORBIDDEN)
        self.owner_user.refresh_from_db()
        self.assertTrue(self.owner_user.is_active)

        # Recipient admin cannot delete account while transfer is pending
        self.client.force_login(self.admin_user)
        admin_res = self.client.delete(
            me_url,
            data={'confirm': self.admin_user.extra_details.uid},
            format='json',
        )
        self.assertEqual(admin_res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            str(admin_res.data['detail']),
            str(PENDING_TRANSFER_ACCOUNT_DELETION_ERROR),
        )
        self.admin_user.refresh_from_db()
        self.assertTrue(self.admin_user.is_active)

    def test_retrieve_transfer(self):
        """
        GET /ownership-transfers/{guid}/ returns transfer metadata.
        Only the sender (owner) and recipient (invited admin) can retrieve it.
        """
        self._create_transfer(
            self.owner_user,
            self.admin_user.username,
            billing_review_requested=True,
        )
        transfer = OrganizationOwnershipTransfer.objects.first()
        detail_url = self._get_detail_url(transfer.guid)

        # 1. Owner can retrieve
        self.client.force_login(self.owner_user)
        res_owner = self.client.get(detail_url)
        self.assertEqual(res_owner.status_code, status.HTTP_200_OK)
        self.assertEqual(res_owner.data['guid'], str(transfer.guid))
        self.assertEqual(res_owner.data['sender'], self.owner_user.username)
        self.assertEqual(
            res_owner.data['sender_name'],
            self.owner_user.extra_details.data.get('name', ''),
        )
        self.assertEqual(res_owner.data['sender_email'], self.owner_user.email)
        self.assertEqual(res_owner.data['recipient'], self.admin_user.username)
        self.assertEqual(res_owner.data['recipient_username'], self.admin_user.username)
        self.assertEqual(
            res_owner.data['status'], OrganizationInviteStatusChoices.PENDING
        )
        self.assertTrue(res_owner.data['billing_review_requested'])
        self.assertEqual(res_owner.data['organization_id'], self.organization.id)
        self.assertEqual(res_owner.data['organization_name'], self.organization.name)

        # 2. Recipient admin can retrieve
        self.client.force_login(self.admin_user)
        res_admin = self.client.get(detail_url)
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        self.assertEqual(res_admin.data['guid'], str(transfer.guid))

        # 3. Another admin in the same org cannot retrieve (403)
        second_admin = User.objects.create(
            username='second_admin',
            email='second_admin@example.com',
            is_active=True,
        )
        self.organization.add_user(second_admin, is_admin=True)
        self.client.force_login(second_admin)
        res_second_admin = self.client.get(detail_url)
        self.assertEqual(res_second_admin.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Member in the same org cannot retrieve (403)
        self.client.force_login(self.member_user)
        res_member = self.client.get(detail_url)
        self.assertEqual(res_member.status_code, status.HTTP_403_FORBIDDEN)

        # 5. External user cannot retrieve (404)
        self.client.force_login(self.external_user)
        res_external = self.client.get(detail_url)
        self.assertEqual(res_external.status_code, status.HTTP_404_NOT_FOUND)

        # 6. Non-existent GUID returns 404
        self.client.force_login(self.owner_user)
        bad_url = self._get_detail_url('00000000-0000-0000-0000-000000000000')
        res_bad = self.client.get(bad_url)
        self.assertEqual(res_bad.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_transfers(self):
        """
        GET /ownership-transfers/ lists transfers for the requesting user.
        Owner sees transfers they sent, recipient sees transfers they received.
        Other admins see only their own. Supports ?status= query filter.
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrganizationOwnershipTransfer.objects.first()

        # 1. Owner sees the transfer they sent
        self.client.force_login(self.owner_user)
        res_owner = self.client.get(self.list_url)
        self.assertEqual(res_owner.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_owner.data['results']), 1)
        self.assertEqual(res_owner.data['results'][0]['guid'], str(transfer.guid))

        # 2. Recipient admin sees the transfer they received
        self.client.force_login(self.admin_user)
        res_admin = self.client.get(self.list_url)
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_admin.data['results']), 1)
        self.assertEqual(res_admin.data['results'][0]['guid'], str(transfer.guid))

        # 3. Another admin sees 0 transfers (neither sender nor recipient)
        second_admin = User.objects.create(
            username='second_admin',
            email='second_admin@example.com',
            is_active=True,
        )
        self.organization.add_user(second_admin, is_admin=True)
        self.client.force_login(second_admin)
        res_second = self.client.get(self.list_url)
        self.assertEqual(res_second.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_second.data['results']), 0)

        # 4. Status filter: matching returns results, non-matching returns empty
        self.client.force_login(self.owner_user)
        res_pending = self.client.get(self.list_url, data={'status': 'pending'})
        self.assertEqual(res_pending.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_pending.data['results']), 1)

        res_accepted = self.client.get(self.list_url, data={'status': 'accepted'})
        self.assertEqual(res_accepted.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_accepted.data['results']), 0)

        # 5. Regular member receives 403 Forbidden
        self.client.force_login(self.member_user)
        res_member = self.client.get(self.list_url)
        self.assertEqual(res_member.status_code, status.HTTP_403_FORBIDDEN)

        # 6. External user receives 404 Not Found
        self.client.force_login(self.external_user)
        res_ext = self.client.get(self.list_url)
        self.assertEqual(res_ext.status_code, status.HTTP_404_NOT_FOUND)

    def test_accept_transfer(self):
        """
        PATCH /ownership-transfers/{guid}/accept/ can only be called by the
        invitee (recipient). Sets status to accepted.
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrganizationOwnershipTransfer.objects.first()
        accept_url = self._get_action_url('accept', transfer.guid)

        # 1. Non-recipient (owner) cannot accept (403)
        self.client.force_login(self.owner_user)
        res_owner = self.client.patch(accept_url)
        self.assertEqual(res_owner.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Member cannot accept (403)
        self.client.force_login(self.member_user)
        res_member = self.client.patch(accept_url)
        self.assertEqual(res_member.status_code, status.HTTP_403_FORBIDDEN)

        # 3. External user receives 404
        self.client.force_login(self.external_user)
        res_ext = self.client.patch(accept_url)
        self.assertEqual(res_ext.status_code, status.HTTP_404_NOT_FOUND)

        # 4. Invitee accepts successfully
        self.client.force_login(self.admin_user)
        res_accept = self.client.patch(accept_url)
        self.assertEqual(res_accept.status_code, status.HTTP_200_OK)
        self.assertEqual(
            res_accept.data['status'], OrganizationInviteStatusChoices.ACCEPTED
        )
        transfer.refresh_from_db()
        self.assertEqual(transfer.status, OrganizationInviteStatusChoices.ACCEPTED)

        # 5. Calling accept on already accepted transfer fails with 400
        res_reaccept = self.client.patch(accept_url)
        self.assertEqual(res_reaccept.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            str(res_reaccept.data['detail']), str(INVITE_ALREADY_ACCEPTED_ERROR)
        )

    def test_demoted_invitee_cannot_accept_transfer(self):
        """
        Invitee cannot accept if they have been demoted to a regular member (403).
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrganizationOwnershipTransfer.objects.first()
        accept_url = self._get_action_url('accept', transfer.guid)

        # Demote admin user to member
        OrganizationUser.objects.filter(
            organization=self.organization, user=self.admin_user
        ).update(is_admin=False)

        self.client.force_login(self.admin_user)
        res = self.client.patch(accept_url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_decline_transfer(self):
        """
        PATCH /ownership-transfers/{guid}/decline/ can only be called by the
        invitee (recipient). Sets status to declined.
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrganizationOwnershipTransfer.objects.first()
        decline_url = self._get_action_url('decline', transfer.guid)

        # 1. Owner cannot decline (403)
        self.client.force_login(self.owner_user)
        res_owner = self.client.patch(decline_url)
        self.assertEqual(res_owner.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Invitee declines successfully
        self.client.force_login(self.admin_user)
        res_decline = self.client.patch(decline_url)
        self.assertEqual(res_decline.status_code, status.HTTP_200_OK)
        self.assertEqual(
            res_decline.data['status'], OrganizationInviteStatusChoices.DECLINED
        )
        transfer.refresh_from_db()
        self.assertEqual(transfer.status, OrganizationInviteStatusChoices.DECLINED)

        # 3. Cannot decline if not pending
        res_again = self.client.patch(decline_url)
        self.assertEqual(res_again.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(str(res_again.data['detail']), str(TRANSFER_NOT_PENDING_ERROR))

    def test_cancel_transfer(self):
        """
        PATCH /ownership-transfers/{guid}/cancel/ can only be called by the
        outgoing owner (sender). Sets status to cancelled.
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrganizationOwnershipTransfer.objects.first()
        cancel_url = self._get_action_url('cancel', transfer.guid)

        # 1. Invitee cannot cancel (403)
        self.client.force_login(self.admin_user)
        res_admin = self.client.patch(cancel_url)
        self.assertEqual(res_admin.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Member cannot cancel (403)
        self.client.force_login(self.member_user)
        res_member = self.client.patch(cancel_url)
        self.assertEqual(res_member.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Owner cancels successfully
        self.client.force_login(self.owner_user)
        res_cancel = self.client.patch(cancel_url)
        self.assertEqual(res_cancel.status_code, status.HTTP_200_OK)
        self.assertEqual(
            res_cancel.data['status'], OrganizationInviteStatusChoices.CANCELLED
        )
        transfer.refresh_from_db()
        self.assertEqual(transfer.status, OrganizationInviteStatusChoices.CANCELLED)

        # 4. Cannot cancel if not pending
        res_again = self.client.patch(cancel_url)
        self.assertEqual(res_again.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(str(res_again.data['detail']), str(TRANSFER_NOT_PENDING_ERROR))

    def test_resend_transfer_and_rate_limiting(self):
        """
        POST /ownership-transfers/{guid}/resend/ resends the invitation email
        and enforces cooldown rate-limiting.
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrganizationOwnershipTransfer.objects.first()
        resend_url = self._get_action_url('resend', transfer.guid)
        self.assertEqual(len(mail.outbox), 1)

        # 1. Invitee cannot resend (403)
        self.client.force_login(self.admin_user)
        res_admin = self.client.post(resend_url)
        self.assertEqual(res_admin.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Owner resends immediately -> rate limited (429)
        self.client.force_login(self.owner_user)
        res_rate_limited = self.client.post(resend_url)
        self.assertEqual(
            res_rate_limited.status_code, status.HTTP_429_TOO_MANY_REQUESTS
        )
        self.assertIn('Retry-After', res_rate_limited.headers)

        # 3. Rewind modified timestamp beyond cooldown period
        fake_modified = timezone.now() - timedelta(
            seconds=settings.ORG_INVITATION_RESENT_RESET_AFTER + 10
        )
        OrganizationOwnershipTransfer.objects.filter(pk=transfer.pk).update(
            modified=fake_modified
        )

        # 4. Owner resends successfully
        res_resend = self.client.post(resend_url)
        self.assertEqual(res_resend.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 2)

        # 5. Cancel transfer -> cannot resend non-pending transfer (400)
        transfer.status = OrganizationInviteStatusChoices.CANCELLED
        transfer.save(update_fields=['status'])

        res_cancelled = self.client.post(resend_url)
        self.assertEqual(res_cancelled.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            str(res_cancelled.data['detail']), str(INVITE_CANNOT_BE_RESENT_ERROR)
        )

    def test_accept_fails_if_transfer_cancelled_concurrently(self):
        """
        If owner cancels while recipient attempts to accept, the row lock and
        re-read inside the transaction detects non-pending status and aborts (400).
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrganizationOwnershipTransfer.objects.first()
        accept_url = self._get_action_url('accept', transfer.guid)

        # In DB, the transfer is cancelled by owner concurrently
        OrganizationOwnershipTransfer.objects.filter(pk=transfer.pk).update(
            status=OrganizationInviteStatusChoices.CANCELLED
        )

        # Stale read simulating concurrent request having read pending status
        stale_transfer = OrganizationOwnershipTransfer.objects.get(pk=transfer.pk)
        stale_transfer.status = OrganizationInviteStatusChoices.PENDING

        with patch.object(
            OrganizationOwnershipTransferViewSet,
            'get_object',
            return_value=stale_transfer,
        ):
            self.client.force_login(self.admin_user)
            res = self.client.patch(accept_url)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertEqual(str(res.data['detail']), str(TRANSFER_NOT_PENDING_ERROR))

    def test_cancel_fails_if_transfer_accepted_concurrently(self):
        """
        If recipient accepts while owner attempts to cancel, the row lock and
        re-read inside the transaction detects non-pending status and aborts (400).
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrganizationOwnershipTransfer.objects.first()
        cancel_url = self._get_action_url('cancel', transfer.guid)

        # In DB, the transfer is accepted by recipient concurrently
        OrganizationOwnershipTransfer.objects.filter(pk=transfer.pk).update(
            status=OrganizationInviteStatusChoices.ACCEPTED
        )

        # Stale read simulating concurrent request having read pending status
        stale_transfer = OrganizationOwnershipTransfer.objects.get(pk=transfer.pk)
        stale_transfer.status = OrganizationInviteStatusChoices.PENDING

        with patch.object(
            OrganizationOwnershipTransferViewSet,
            'get_object',
            return_value=stale_transfer,
        ):
            self.client.force_login(self.owner_user)
            res = self.client.patch(cancel_url)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertEqual(str(res.data['detail']), str(TRANSFER_NOT_PENDING_ERROR))

    def test_resend_fails_if_cooldown_triggered_concurrently(self):
        """
        If concurrent resend requests pass initial read, the row lock and
        re-read inside transaction enforces cooldown rate limiting (429).
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrganizationOwnershipTransfer.objects.first()
        resend_url = self._get_action_url('resend', transfer.guid)

        # In DB, the transfer was modified/resent by concurrent request
        OrganizationOwnershipTransfer.objects.filter(pk=transfer.pk).update(
            modified=timezone.now()
        )

        # Stale read simulating cooldown elapsed on initial fetch
        stale_transfer = OrganizationOwnershipTransfer.objects.get(pk=transfer.pk)
        stale_transfer.modified = timezone.now() - timedelta(
            seconds=settings.ORG_INVITATION_RESENT_RESET_AFTER + 60
        )

        with patch.object(
            OrganizationOwnershipTransferViewSet,
            'get_object',
            return_value=stale_transfer,
        ):
            self.client.force_login(self.owner_user)
            res = self.client.post(resend_url)
            self.assertEqual(res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_transfer_creation_fails_if_recipient_demoted_concurrently(self):
        """
        If recipient is demoted concurrently after initial validation passes,
        the row lock and re-check inside create() detects they are no longer an
        admin and aborts (400).
        """
        OrganizationUser.objects.filter(
            organization=self.organization, user=self.admin_user
        ).update(is_admin=False)

        with patch.object(
            OrganizationOwnershipTransferSerializer,
            'validate_recipient',
            return_value=self.admin_user,
        ):
            self.client.force_login(self.owner_user)
            res = self._create_transfer(self.owner_user, self.admin_user.username)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn('recipient', res.data)
            self.assertEqual(
                str(res.data['recipient'][0]),
                str(RECIPIENT_MUST_BE_ADMIN_ERROR),
            )
            self.assertEqual(OrganizationOwnershipTransfer.objects.count(), 0)

    def test_transfer_creation_fails_if_recipient_removed_concurrently(self):
        """
        If recipient is removed from the organization concurrently after initial
        validation passes, the row lock inside create() detects they are no
        longer a member and aborts (400).
        """
        OrganizationUser.objects.filter(
            organization=self.organization, user=self.admin_user
        ).delete()

        with patch.object(
            OrganizationOwnershipTransferSerializer,
            'validate_recipient',
            return_value=self.admin_user,
        ):
            self.client.force_login(self.owner_user)
            res = self._create_transfer(self.owner_user, self.admin_user.username)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn('recipient', res.data)
            self.assertEqual(
                str(res.data['recipient'][0]),
                str(RECIPIENT_MUST_BE_ADMIN_ERROR),
            )
            self.assertEqual(OrganizationOwnershipTransfer.objects.count(), 0)

    def test_transfer_creation_fails_if_recipient_deactivates_concurrently(self):
        """
        If recipient account is deactivated/deleted concurrently after initial
        validation passes, the row lock and re-check inside create() detects
        the inactive status and aborts (400).
        """
        User.objects.filter(pk=self.admin_user.pk).update(is_active=False)

        with patch.object(
            OrganizationOwnershipTransferSerializer,
            'validate_recipient',
            return_value=self.admin_user,
        ):
            self.client.force_login(self.owner_user)
            res = self._create_transfer(self.owner_user, self.admin_user.username)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn('recipient', res.data)
            self.assertEqual(
                str(res.data['recipient'][0]),
                str(RECIPIENT_MUST_BE_ADMIN_ERROR),
            )
            self.assertEqual(OrganizationOwnershipTransfer.objects.count(), 0)

    def test_demote_fails_if_transfer_created_concurrently(self):
        """
        If ownership transfer is created concurrently while a role change is in
        flight, the row lock and re-read inside update() detects the pending
        transfer and aborts (400).
        """
        admin_detail_url = reverse(
            self._get_endpoint('organization-members-detail'),
            kwargs={
                'uid_organization': self.organization.id,
                'username': self.admin_user.username,
            },
        )
        self.client.force_login(self.owner_user)

        OrganizationOwnershipTransfer.objects.create(
            organization=self.organization,
            sender=self.owner_user,
            recipient=self.admin_user,
            status=OrganizationInviteStatusChoices.PENDING,
        )

        with patch.object(
            OrganizationUserSerializer,
            'validate_role',
            return_value='member',
        ):
            res = self.client.patch(admin_detail_url, data={'role': 'member'})
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertEqual(
                str(res.data['detail']),
                str(PENDING_TRANSFER_ROLE_LOCKED_ERROR),
            )

    def test_member_removal_fails_if_transfer_created_concurrently(self):
        """
        If ownership transfer is created concurrently while member removal is in
        flight, the row lock and re-read inside perform_destroy() detects the
        pending transfer and aborts (400).
        """
        admin_detail_url = reverse(
            self._get_endpoint('organization-members-detail'),
            kwargs={
                'uid_organization': self.organization.id,
                'username': self.admin_user.username,
            },
        )
        self.client.force_login(self.owner_user)

        OrganizationOwnershipTransfer.objects.create(
            organization=self.organization,
            sender=self.owner_user,
            recipient=self.admin_user,
            status=OrganizationInviteStatusChoices.PENDING,
        )

        res = self.client.delete(admin_detail_url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            str(res.data['detail']),
            str(PENDING_TRANSFER_MEMBER_REMOVAL_ERROR),
        )

    @override_config(ALLOW_SELF_ACCOUNT_DELETION=True)
    def test_account_deletion_fails_if_transfer_created_concurrently(self):
        """
        If ownership transfer is created concurrently while account deletion is in
        flight, the row lock and re-read inside destroy() detects the pending
        transfer and aborts (403).
        """
        me_url = reverse('currentuser-detail')
        self.client.force_login(self.admin_user)

        OrganizationOwnershipTransfer.objects.create(
            organization=self.organization,
            sender=self.owner_user,
            recipient=self.admin_user,
            status=OrganizationInviteStatusChoices.PENDING,
        )

        res = self.client.delete(
            me_url,
            data={'confirm': self.admin_user.extra_details.uid},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            str(res.data['detail']),
            str(PENDING_TRANSFER_ACCOUNT_DELETION_ERROR),
        )
