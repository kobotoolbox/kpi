from datetime import timedelta
from unittest.mock import patch

from celery.exceptions import SoftTimeLimitExceeded
from constance import config
from ddt import data, ddt, unpack
from django.conf import settings
from django.contrib.admin.sites import AdminSite
from django.core import mail
from django.db import IntegrityError
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.admin.organization_owner import OrgOwnerAdmin
from kobo.apps.organizations.constants import (
    INVITE_ALREADY_ACCEPTED_ERROR,
    INVITE_CANNOT_BE_RESENT_ERROR,
    OWNERSHIP_TRANSFER_ALREADY_PENDING_ERROR,
    OWNERSHIP_TRANSFER_IN_PROGRESS_MEMBER_REMOVAL_ERROR,
    RECIPIENT_AMBIGUOUS_EMAIL_ERROR,
    RECIPIENT_MUST_BE_ADMIN_ERROR,
    TRANSFER_EXPIRED_ERROR,
    TRANSFER_NO_LONGER_VALID_ERROR,
    TRANSFER_NOT_PENDING_ERROR,
)
from kobo.apps.organizations.models import OrganizationOwner, OrganizationUser
from kobo.apps.organizations.permissions import (
    OrganizationOwnershipTransferPermission,
)
from kobo.apps.organizations.tasks import (
    mark_organization_invite_as_expired,
    transfer_organization_ownership,
)
from kobo.apps.organizations.tests.test_organizations_api import (
    BaseOrganizationAssetApiTestCase,
)
from kobo.apps.organizations.views import OrganizationOwnershipTransferViewSet
from kobo.apps.project_ownership.models import (
    Invite,
    InviteStatusChoices,
    OrgOwnershipTransferInvite,
    Transfer,
    TransferStatus,
    TransferStatusChoices,
)
from kpi.exceptions import MailerError
from kpi.models.asset import Asset
from kpi.tests.utils.transaction import immediate_on_commit
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

    def _get_detail_url(self, uid):
        return reverse(
            self._get_endpoint('organization-ownership-transfers-detail'),
            kwargs={'uid_organization': self.organization.id, 'uid': uid},
        )

    def _get_action_url(self, action_name, uid):
        return reverse(
            self._get_endpoint(f'organization-ownership-transfers-{action_name}'),
            kwargs={'uid_organization': self.organization.id, 'uid': uid},
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

    def test_retrieve_transfer(self):
        """
        GET /ownership-transfers/{uid}/ returns transfer metadata.
        Only the sender (owner) and recipient (invited admin) can retrieve it.
        """
        self._create_transfer(
            self.owner_user,
            self.admin_user.username,
            billing_review_requested=True,
        )
        transfer = OrgOwnershipTransferInvite.objects.first()
        detail_url = self._get_detail_url(transfer.uid)

        # 1. Owner can retrieve
        self.client.force_login(self.owner_user)
        res_owner = self.client.get(detail_url)
        self.assertEqual(res_owner.status_code, status.HTTP_200_OK)
        self.assertEqual(res_owner.data['uid'], str(transfer.uid))
        self.assertEqual(res_owner.data['sender'], self.owner_user.username)
        self.assertEqual(
            res_owner.data['sender_name'],
            self.owner_user.extra_details.data.get('name', ''),
        )
        self.assertEqual(res_owner.data['sender_email'], self.owner_user.email)
        self.assertEqual(res_owner.data['recipient'], self.admin_user.username)
        self.assertNotIn('recipient_username', res_owner.data)
        self.assertEqual(res_owner.data['status'], InviteStatusChoices.PENDING)
        self.assertTrue(res_owner.data['billing_review_requested'])
        self.assertEqual(res_owner.data['organization_id'], self.organization.id)
        self.assertEqual(res_owner.data['organization_name'], self.organization.name)

        # 2. Recipient admin can retrieve
        self.client.force_login(self.admin_user)
        res_admin = self.client.get(detail_url)
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        self.assertEqual(res_admin.data['uid'], str(transfer.uid))

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

        # 6. Non-existent UID returns 404
        self.client.force_login(self.owner_user)
        bad_url = self._get_detail_url('poi00000000000000000000')
        res_bad = self.client.get(bad_url)
        self.assertEqual(res_bad.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_transfers(self):
        """
        GET /ownership-transfers/ lists transfers for the requesting user.
        Owner sees transfers they sent, recipient sees transfers they received.
        Other admins see only their own. Supports ?status= query filter.
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrgOwnershipTransferInvite.objects.first()

        # 1. Owner sees the transfer they sent
        self.client.force_login(self.owner_user)
        res_owner = self.client.get(self.list_url)
        self.assertEqual(res_owner.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_owner.data['results']), 1)
        self.assertEqual(res_owner.data['results'][0]['uid'], str(transfer.uid))

        # 2. Recipient admin sees the transfer they received
        self.client.force_login(self.admin_user)
        res_admin = self.client.get(self.list_url)
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_admin.data['results']), 1)
        self.assertEqual(res_admin.data['results'][0]['uid'], str(transfer.uid))

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
        PATCH /ownership-transfers/{uid}/accept/ can only be called by the
        invitee (recipient). Sets status to accepted.
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrgOwnershipTransferInvite.objects.first()
        accept_url = self._get_action_url('accept', transfer.uid)

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
        with (
            immediate_on_commit(),
            patch(
                'kobo.apps.organizations.views.transfer_organization_ownership.delay'
            ) as mock_task,
        ):
            res_accept = self.client.patch(accept_url)
            self.assertEqual(res_accept.status_code, status.HTTP_200_OK)
            self.assertEqual(res_accept.data['status'], InviteStatusChoices.ACCEPTED)
            transfer.refresh_from_db()
            self.assertEqual(transfer.status, InviteStatusChoices.ACCEPTED)
            mock_task.assert_called_once_with(transfer.pk)

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
        transfer = OrgOwnershipTransferInvite.objects.first()
        accept_url = self._get_action_url('accept', transfer.uid)

        # Demote admin user to member
        OrganizationUser.objects.filter(
            organization=self.organization, user=self.admin_user
        ).update(is_admin=False)

        self.client.force_login(self.admin_user)
        res = self.client.patch(accept_url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_accept_fails_if_sender_is_no_longer_owner(self):
        """
        If the sender is no longer the owner of the organization at accept time
        (e.g. ownership changed outside the admin workflow), the request fails
        with 400 Validation Error.
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrgOwnershipTransferInvite.objects.first()
        accept_url = self._get_action_url('accept', transfer.uid)

        # Directly reassign ownership outside admin workflow
        new_owner = User.objects.create(
            username='new_owner',
            email='new_owner@example.com',
            is_active=True,
        )
        self.organization.add_user(new_owner, is_admin=True)
        new_owner_org_user = self.organization.organization_users.get(user=new_owner)
        self.organization.owner.organization_user = new_owner_org_user
        self.organization.owner.save(update_fields=['organization_user'])

        self.client.force_login(self.admin_user)
        res = self.client.patch(accept_url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(str(res.data['detail']), str(TRANSFER_NO_LONGER_VALID_ERROR))

    def test_former_admin_cannot_accept_transfer_after_joining_another_team(self):
        """
        If an invitee leaves team A and joins team B as an admin, they cannot
        accept team A's transfer through team B's endpoint (404), nor can they
        accept it through team A's endpoint (404).
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrgOwnershipTransferInvite.objects.first()

        # admin_user is removed from team A
        self.organization.organization_users.filter(user=self.admin_user).delete()

        # admin_user joins team B as an admin
        team_b_owner = User.objects.create(
            username='team_b_owner',
            email='team_b_owner@example.com',
            is_active=True,
        )
        team_b = team_b_owner.organization
        team_b.mmo_override = True
        team_b.save(update_fields=['mmo_override'])
        team_b.add_user(self.admin_user, is_admin=True)

        # 1. Attempt to accept team A's transfer through team B's URL -> 404
        team_b_accept_url = reverse(
            self._get_endpoint('organization-ownership-transfers-accept'),
            kwargs={'uid_organization': team_b.id, 'uid': transfer.uid},
        )
        self.client.force_login(self.admin_user)
        res_b = self.client.patch(team_b_accept_url)
        self.assertEqual(res_b.status_code, status.HTTP_404_NOT_FOUND)

        # 2. Attempt to accept through team A's URL -> 404 (no longer a member of A)
        team_a_accept_url = self._get_action_url('accept', transfer.uid)
        res_a = self.client.patch(team_a_accept_url)
        self.assertEqual(res_a.status_code, status.HTTP_404_NOT_FOUND)

    def test_accept_fails_if_recipient_no_longer_admin_in_organization(self):
        """
        If recipient is no longer an active admin in the organization at accept time,
        accept() rejects with 400 Validation Error.
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrgOwnershipTransferInvite.objects.first()
        accept_url = self._get_action_url('accept', transfer.uid)

        # Demote recipient to member
        self.organization.organization_users.filter(user=self.admin_user).update(
            is_admin=False
        )

        with patch.object(
            OrganizationOwnershipTransferPermission,
            'has_permission',
            return_value=True,
        ):
            self.client.force_login(self.admin_user)
            res = self.client.patch(accept_url)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertEqual(
                str(res.data['detail']), str(TRANSFER_NO_LONGER_VALID_ERROR)
            )

    def test_decline_transfer(self):
        """
        PATCH /ownership-transfers/{uid}/decline/ can only be called by the
        invitee (recipient). Sets status to declined.
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrgOwnershipTransferInvite.objects.first()
        decline_url = self._get_action_url('decline', transfer.uid)

        # 1. Owner cannot decline (403)
        self.client.force_login(self.owner_user)
        res_owner = self.client.patch(decline_url)
        self.assertEqual(res_owner.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Invitee declines successfully
        self.client.force_login(self.admin_user)
        res_decline = self.client.patch(decline_url)
        self.assertEqual(res_decline.status_code, status.HTTP_200_OK)
        self.assertEqual(res_decline.data['status'], InviteStatusChoices.DECLINED)
        transfer.refresh_from_db()
        self.assertEqual(transfer.status, InviteStatusChoices.DECLINED)

        sent_emails = {m.to[0]: m.subject for m in mail.outbox}
        self.assertEqual(
            sent_emails.get(self.owner_user.email),
            'KoboToolbox team ownership transfer incomplete',
        )
        self.assertEqual(
            sent_emails.get(self.admin_user.email),
            f'You have declined ownership of {self.organization.name}.',
        )

        # 3. Cannot decline if not pending
        res_again = self.client.patch(decline_url)
        self.assertEqual(res_again.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(str(res_again.data['detail']), str(TRANSFER_NOT_PENDING_ERROR))

    def test_cancel_transfer(self):
        """
        PATCH /ownership-transfers/{uid}/cancel/ can only be called by the
        outgoing owner (sender). Sets status to cancelled.
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrgOwnershipTransferInvite.objects.first()
        cancel_url = self._get_action_url('cancel', transfer.uid)

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
        self.assertEqual(res_cancel.data['status'], InviteStatusChoices.CANCELLED)
        transfer.refresh_from_db()
        self.assertEqual(transfer.status, InviteStatusChoices.CANCELLED)

        # 4. Cannot cancel if not pending
        res_again = self.client.patch(cancel_url)
        self.assertEqual(res_again.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(str(res_again.data['detail']), str(TRANSFER_NOT_PENDING_ERROR))

    def test_resend_transfer_and_rate_limiting(self):
        """
        POST /ownership-transfers/{uid}/resend/ resends the invitation email
        and enforces cooldown rate-limiting.
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrgOwnershipTransferInvite.objects.first()
        resend_url = self._get_action_url('resend', transfer.uid)
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
        OrgOwnershipTransferInvite.objects.filter(pk=transfer.pk).update(
            date_modified=fake_modified
        )

        # 4. Owner resends successfully
        res_resend = self.client.post(resend_url)
        self.assertEqual(res_resend.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 2)

        # 5. Cancel transfer -> cannot resend non-pending transfer (400)
        transfer.status = InviteStatusChoices.CANCELLED
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
        transfer = OrgOwnershipTransferInvite.objects.first()
        accept_url = self._get_action_url('accept', transfer.uid)

        # In DB, the transfer is cancelled by owner concurrently
        OrgOwnershipTransferInvite.objects.filter(pk=transfer.pk).update(
            status=InviteStatusChoices.CANCELLED
        )

        # Stale read simulating concurrent request having read pending status
        stale_transfer = OrgOwnershipTransferInvite.objects.get(pk=transfer.pk)
        stale_transfer.status = InviteStatusChoices.PENDING

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
        transfer = OrgOwnershipTransferInvite.objects.first()
        cancel_url = self._get_action_url('cancel', transfer.uid)

        # In DB, the transfer is accepted by recipient concurrently
        OrgOwnershipTransferInvite.objects.filter(pk=transfer.pk).update(
            status=InviteStatusChoices.ACCEPTED
        )

        # Stale read simulating concurrent request having read pending status
        stale_transfer = OrgOwnershipTransferInvite.objects.get(pk=transfer.pk)
        stale_transfer.status = InviteStatusChoices.PENDING

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
        transfer = OrgOwnershipTransferInvite.objects.first()
        resend_url = self._get_action_url('resend', transfer.uid)

        # In DB, the transfer was modified/resent by concurrent request
        OrgOwnershipTransferInvite.objects.filter(pk=transfer.pk).update(
            date_modified=timezone.now()
        )

        # Stale read simulating cooldown elapsed on initial fetch
        stale_transfer = OrgOwnershipTransferInvite.objects.get(pk=transfer.pk)
        stale_transfer.date_modified = timezone.now() - timedelta(
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

    def test_transfer_organization_ownership_task_success(self):
        """
        When transfer_organization_ownership executes:
        - OrganizationOwner is atomically reassigned to the recipient.
        - Outgoing owner's member record is updated to Admin (is_admin = True).
        - create_invite is called with OrgMembershipAutoInvite for owner assets.
        - Transfer status is updated to COMPLETE.
        - Completion email is sent to both the outgoing and incoming owners.
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrgOwnershipTransferInvite.objects.first()
        asset = Asset.objects.create(name='Org Project', owner=self.owner_user)

        with (
            immediate_on_commit(),
            patch('kobo.apps.organizations.tasks.create_invite') as mock_create_invite,
        ):
            transfer_organization_ownership(transfer.pk)

        # 1. OrganizationOwner is updated
        self.organization.refresh_from_db()
        self.assertEqual(self.organization.owner_user_object, self.admin_user)
        org_owner = OrganizationOwner.objects.get(organization=self.organization)
        self.assertEqual(org_owner.organization_user.user, self.admin_user)

        # 2. Outgoing owner is now an admin
        outgoing_org_user = OrganizationUser.objects.get(
            organization=self.organization, user=self.owner_user
        )
        self.assertTrue(outgoing_org_user.is_admin)

        # 3. create_invite called for batch project transfers
        mock_create_invite.assert_called()
        call_kwargs = mock_create_invite.call_args.kwargs
        self.assertEqual(call_kwargs['sender'], self.owner_user)
        self.assertEqual(call_kwargs['recipient'], self.admin_user)
        self.assertEqual(call_kwargs['invite_class_name'], 'OrgMembershipAutoInvite')
        transferred_asset_pks = [a.pk for a in call_kwargs['assets']]
        self.assertIn(asset.pk, transferred_asset_pks)

        # 4. Transfer status is COMPLETE
        transfer.refresh_from_db()
        self.assertEqual(transfer.status, InviteStatusChoices.COMPLETE)

        # 5. Completion email sent to both owners
        sent_emails = {m.to[0]: m.subject for m in mail.outbox}
        self.assertEqual(
            sent_emails.get(self.owner_user.email),
            'KoboToolbox team ownership transfer complete',
        )
        self.assertEqual(
            sent_emails.get(self.admin_user.email),
            f'You are now the owner of the {self.organization.name} team',
        )

    def test_transfer_organization_ownership_task_with_zero_assets(self):
        """
        When outgoing owner owns no projects:
        - OrganizationOwner and member roles are updated properly.
        - No project invites are created.
        - Transfer is marked COMPLETE and completion emails are sent.
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrgOwnershipTransferInvite.objects.first()
        self.owner_user.assets.all().delete()

        with (
            immediate_on_commit(),
            patch('kobo.apps.organizations.tasks.create_invite') as mock_create_invite,
        ):
            transfer_organization_ownership(transfer.pk)

        mock_create_invite.assert_not_called()
        self.organization.refresh_from_db()
        self.assertEqual(self.organization.owner_user_object, self.admin_user)
        transfer.refresh_from_db()
        self.assertEqual(transfer.status, InviteStatusChoices.COMPLETE)

    def test_transfer_organization_ownership_task_failure_marks_status_failed(self):
        """
        When an exception occurs during transfer execution:
        - The atomic block rolls back (OrganizationOwner not switched).
        - Transfer status is updated to FAILED.
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrgOwnershipTransferInvite.objects.first()
        Asset.objects.create(name='Failing Project', owner=self.owner_user)

        with (
            patch(
                'kobo.apps.organizations.tasks.create_invite',
                side_effect=RuntimeError('Database disk full'),
            ),
            self.assertRaises(RuntimeError),
        ):
            transfer_organization_ownership(transfer.pk)

        transfer.refresh_from_db()
        self.assertEqual(transfer.status, InviteStatusChoices.FAILED)
        self.organization.refresh_from_db()
        self.assertEqual(self.organization.owner_user_object, self.admin_user)

    def test_transfer_organization_ownership_task_skips_terminal_status(self):
        """
        If the transfer is already complete, cancelled, declined, or failed,
        the task returns early without re-executing.
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrgOwnershipTransferInvite.objects.first()
        transfer.status = InviteStatusChoices.COMPLETE
        transfer.save(update_fields=['status'])

        with patch('kobo.apps.organizations.tasks.create_invite') as mock_create_invite:
            transfer_organization_ownership(transfer.pk)

        mock_create_invite.assert_not_called()
        self.organization.refresh_from_db()
        self.assertEqual(self.organization.owner_user_object, self.owner_user)

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

    def test_soft_time_limit_keeps_in_progress_and_resumes_on_retry(self):
        """
        SoftTimeLimitExceeded leaves the transfer IN_PROGRESS so a retry can
        resume and complete the transfer.
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrgOwnershipTransferInvite.objects.first()
        Asset.objects.create(name='Org Project', owner=self.owner_user)

        with (
            patch(
                'kobo.apps.organizations.tasks.create_invite',
                side_effect=SoftTimeLimitExceeded(),
            ),
            self.assertRaises(SoftTimeLimitExceeded),
        ):
            transfer_organization_ownership(transfer.pk)

        transfer.refresh_from_db()
        self.assertEqual(transfer.status, InviteStatusChoices.IN_PROGRESS)

        with (
            immediate_on_commit(),
            patch('kobo.apps.organizations.tasks.create_invite') as mock_create_invite,
        ):
            transfer_organization_ownership(transfer.pk)

        mock_create_invite.assert_called_once()
        transfer.refresh_from_db()
        self.assertEqual(transfer.status, InviteStatusChoices.COMPLETE)

    def test_repeat_transfer_does_not_skip_previously_transferred_assets(self):
        """
        Historical project transfers between the same sender and recipient
        created before the current org transfer do not exclude assets.
        """
        asset = Asset.objects.create(name='Repeat Project', owner=self.owner_user)
        old_invite = Invite.objects.create(
            sender=self.owner_user, recipient=self.admin_user
        )
        old_transfer = Transfer.objects.create(invite=old_invite, asset=asset)
        past = timezone.now() - timedelta(days=5)
        Transfer.objects.filter(pk=old_transfer.pk).update(date_created=past)

        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrgOwnershipTransferInvite.objects.first()

        with (
            immediate_on_commit(),
            patch('kobo.apps.organizations.tasks.create_invite') as mock_create_invite,
        ):
            transfer_organization_ownership(transfer.pk)

        mock_create_invite.assert_called_once()
        transferred_pks = [a.pk for a in mock_create_invite.call_args.kwargs['assets']]
        self.assertIn(asset.pk, transferred_pks)

    def test_cannot_create_transfer_while_accepted_or_in_progress(self):
        """
        Creating a new ownership transfer is blocked while an existing one is
        ACCEPTED or IN_PROGRESS.
        """
        for active_status in (
            InviteStatusChoices.ACCEPTED,
            InviteStatusChoices.IN_PROGRESS,
        ):
            OrgOwnershipTransferInvite.objects.all().delete()
            OrgOwnershipTransferInvite.objects.create(
                sender=self.owner_user,
                recipient=self.admin_user,
                organization=self.organization,
                status=active_status,
            )
            res = self._create_transfer(self.owner_user, self.admin_user.username)
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn(
                str(OWNERSHIP_TRANSFER_ALREADY_PENDING_ERROR),
                str(res.data['detail']),
            )

    def test_stale_transfer_rejected_in_worker(self):
        """
        If the sender is no longer the organization owner when the worker runs,
        the transfer is marked FAILED and ownership is not overwritten.
        """
        third_admin = User.objects.create_user(
            username='third_admin', email='third_admin@example.com', password='pw'
        )
        third_org_user = OrganizationUser.objects.create(
            organization=self.organization, user=third_admin, is_admin=True
        )
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrgOwnershipTransferInvite.objects.first()

        org_owner = OrganizationOwner.objects.get(organization=self.organization)
        org_owner.organization_user = third_org_user
        org_owner.save(update_fields=['organization_user'])

        with patch('kobo.apps.organizations.tasks.create_invite') as mock_create_invite:
            transfer_organization_ownership(transfer.pk)

        mock_create_invite.assert_not_called()
        transfer.refresh_from_db()
        self.assertEqual(transfer.status, InviteStatusChoices.FAILED)
        self.organization.refresh_from_db()
        self.assertEqual(self.organization.owner_user_object, third_admin)

    def test_failed_project_transfer_marks_org_transfer_failed(self):
        """
        If a project transfer within a batch fails, the organization transfer
        is marked FAILED and completion emails are not sent.
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrgOwnershipTransferInvite.objects.first()
        asset = Asset.objects.create(name='Broken Project', owner=self.owner_user)
        mail.outbox.clear()

        def fail_project_transfer(**kwargs):
            inv = Invite.objects.create(
                sender=kwargs['sender'], recipient=kwargs['recipient']
            )
            proj_transfer = Transfer.objects.create(invite=inv, asset=asset)
            TransferStatus.objects.create(
                transfer=proj_transfer, status=TransferStatusChoices.FAILED
            )
            return inv

        with (
            immediate_on_commit(),
            patch(
                'kobo.apps.organizations.tasks.create_invite',
                side_effect=fail_project_transfer,
            ),
        ):
            transfer_organization_ownership(transfer.pk)

        transfer.refresh_from_db()
        self.assertEqual(transfer.status, InviteStatusChoices.FAILED)
        self.assertEqual(len(mail.outbox), 0)

    def test_accept_expired_transfer_fails_and_marks_expired(self):
        """
        Accepting a transfer older than PROJECT_OWNERSHIP_INVITE_EXPIRY marks it
        EXPIRED and returns 400.
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrgOwnershipTransferInvite.objects.first()
        expired_date = timezone.now() - timedelta(
            days=config.PROJECT_OWNERSHIP_INVITE_EXPIRY + 1
        )
        OrgOwnershipTransferInvite.objects.filter(pk=transfer.pk).update(
            date_created=expired_date
        )

        accept_url = reverse(
            self._get_endpoint('organization-ownership-transfers-accept'),
            kwargs={
                'uid_organization': self.organization.id,
                'uid': transfer.uid,
            },
        )
        with self.authentication(self.admin_user):
            res = self.client.patch(accept_url)

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data['detail'], str(TRANSFER_EXPIRED_ERROR))
        transfer.refresh_from_db()
        self.assertEqual(transfer.status, InviteStatusChoices.EXPIRED)

    def test_mark_organization_invite_as_expired_expires_ownership_transfers(self):
        """
        The periodic expiry task expires pending ownership transfers past the
        expiry threshold.
        """
        self._create_transfer(self.owner_user, self.admin_user.username)
        transfer = OrgOwnershipTransferInvite.objects.first()
        expired_date = timezone.now() - timedelta(
            days=config.PROJECT_OWNERSHIP_INVITE_EXPIRY + 1
        )
        OrgOwnershipTransferInvite.objects.filter(pk=transfer.pk).update(
            date_created=expired_date
        )

        mark_organization_invite_as_expired()

        transfer.refresh_from_db()
        self.assertEqual(transfer.status, InviteStatusChoices.EXPIRED)

    def test_cannot_remove_member_during_in_progress_ownership_transfer(self):
        """
        Removing a member involved in an ACCEPTED or IN_PROGRESS ownership
        transfer is blocked so background batches cannot restore their access.
        """
        OrgOwnershipTransferInvite.objects.create(
            sender=self.owner_user,
            recipient=self.admin_user,
            organization=self.organization,
            status=InviteStatusChoices.IN_PROGRESS,
        )
        admin_member = OrganizationUser.objects.get(
            organization=self.organization, user=self.admin_user
        )
        member_url = reverse(
            self._get_endpoint('organization-members-detail'),
            kwargs={
                'uid_organization': self.organization.id,
                'username': admin_member.user.username,
            },
        )
        with self.authentication(self.owner_user):
            res = self.client.delete(member_url)

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(
            str(OWNERSHIP_TRANSFER_IN_PROGRESS_MEMBER_REMOVAL_ERROR),
            str(res.data),
        )
        self.assertTrue(
            OrganizationUser.objects.filter(pk=admin_member.pk).exists()
        )
