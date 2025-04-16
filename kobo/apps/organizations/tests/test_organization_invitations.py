from datetime import timedelta

from ddt import ddt, data, unpack
from constance.test import override_config
from django.conf import settings
from django.core import mail
from django.urls import reverse
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext as t
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.constants import (
    INVITE_OWNER_ERROR,
    INVITE_MEMBER_ERROR,
    INVITE_ALREADY_ACCEPTED_ERROR,
    ORG_ADMIN_ROLE,
    ORG_MEMBER_ROLE,
)
from kobo.apps.organizations.models import (
    Organization,
    OrganizationInvitation,
    OrganizationInviteStatusChoices,
)
from kobo.apps.organizations.tasks import mark_organization_invite_as_expired
from kobo.apps.organizations.tests.test_organizations_api import (
    BaseOrganizationAssetApiTestCase
)
from kpi.models import Asset
from kpi.tests.utils.transaction import immediate_on_commit
from kpi.urls.router_api_v2 import URL_NAMESPACE
from kpi.utils.placeholders import replace_placeholders


class BaseOrganizationInviteTestCase(BaseOrganizationAssetApiTestCase):
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
            self._get_endpoint('organization-invites-list'),
            kwargs={'organization_id': self.organization.id},
        )
        self.detail_url = lambda guid: reverse(
            self._get_endpoint('organization-invites-detail'),
            kwargs={
                'organization_id': self.organization.id,
                'guid': guid
            },
        )
        self.invitation_data = {
            'invitees': ['bob', 'unregistereduser@example.com']
        }

    def _create_invite(self, invited_by):
        """
        Helper method to create invitations
        """
        self.client.force_login(invited_by)
        return self.client.post(self.list_url, data=self.invitation_data)

    def _update_invite(self, user, guid, status):
        """
        Helper method to update invitation status
        """
        self.client.force_login(user)
        return self.client.patch(self.detail_url(guid), data={'status': status})


@ddt
class OrganizationInviteTestCase(BaseOrganizationInviteTestCase):

    @data(
        ('owner', status.HTTP_201_CREATED),
        ('admin', status.HTTP_201_CREATED),
        ('member', status.HTTP_403_FORBIDDEN),
        ('external', status.HTTP_404_NOT_FOUND)
    )
    @unpack
    def test_user_can_send_invitation(self, user_role, expected_status):
        """
        Test that only organization owner or admin can create invitations
        """
        user = getattr(self, f'{user_role}_user')
        response = self._create_invite(user)
        self.assertEqual(response.status_code, expected_status)
        if response.status_code == status.HTTP_201_CREATED:
            self.assertEqual(
                len(response.data), len(self.invitation_data['invitees'])
            )
            for index, invitation in enumerate(response.data):
                self.assertIn(
                    invitation['invitee'], self.invitation_data['invitees']
                )
                # Check that the email was sent
                invite = User.objects.filter(
                    Q(username=invitation['invitee']) |
                    Q(email=invitation['invitee'])
                ).first()
                self.assertEqual(
                    mail.outbox[index].to[0],
                    invite.email if invite else invitation['invitee']
                )

    @data(
        ('owner', status.HTTP_200_OK),
        ('admin', status.HTTP_200_OK),
        ('member', status.HTTP_403_FORBIDDEN),
        ('external', status.HTTP_400_BAD_REQUEST)
    )
    @unpack
    def test_user_can_resend_invitation(self, user_role, expected_status):
        """
        Test that only the org owner or admins can resend an existing invitation
        """
        self._create_invite(self.owner_user)
        user = getattr(self, f'{user_role}_user')

        # Get mail count before resending the invitation
        initial_mail_count = len(mail.outbox)

        self.client.force_login(user)
        invitation = OrganizationInvitation.objects.get(
            invitee=self.external_user
        )
        # Update invitation like it was created 10 minutes ago to test
        # two resent PATCH requests in a row.
        fake_date_created = timezone.now() - timedelta(
            seconds=settings.ORG_INVITATION_RESENT_RESET_AFTER + 60
        )
        OrganizationInvitation.objects.filter(id=invitation.pk).update(
            created=fake_date_created, modified=fake_date_created
        )

        response = self.client.patch(
            self.detail_url(invitation.guid),
            data={'status': OrganizationInviteStatusChoices.RESENT},
        )
        self.assertEqual(response.status_code, expected_status)
        if response.status_code == status.HTTP_200_OK:
            self.assertEqual(
                response.data['status'], OrganizationInviteStatusChoices.PENDING
            )

            # Verify an additional email has been sent
            self.assertEqual(len(mail.outbox), initial_mail_count + 1)
            resent_email = mail.outbox[-1]
            self.assertEqual(resent_email.to[0], invitation.invitee.email)
            self.assertIn(
                f"You're invited to join {self.organization.name} organization",
                resent_email.subject
            )

    def test_admin_cannot_resend_invitation_several_times_in_a_row(self):
        """
        Test that only the organization owner or admins can resend an invitation
        """
        self._create_invite(self.owner_user)
        user = self.admin_user
        self.client.force_login(user)
        invitation = OrganizationInvitation.objects.get(
            invitee=self.external_user
        )

        # Update invitation like it was created 10 minutes ago to test
        # two resent PATCH requests in a row.
        fake_date_created = timezone.now() - timedelta(
            seconds=settings.ORG_INVITATION_RESENT_RESET_AFTER + 60
        )
        OrganizationInvitation.objects.filter(id=invitation.pk).update(
            created=fake_date_created, modified=fake_date_created
        )

        # The first request should be ok
        response = self.client.patch(
            self.detail_url(invitation.guid),
            data={'status': OrganizationInviteStatusChoices.RESENT},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # The second request should be blocked
        response = self.client.patch(
            self.detail_url(invitation.guid),
            data={'status': OrganizationInviteStatusChoices.RESENT},
        )
        self.assertContains(
            response,
            'Invitation was resent too quickly',
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )
        assert 'Retry-After' in response.headers

    def test_admin_cannot_resend_invitation_if_not_pending(self):
        """
        Test that only the organization owner or admins can resend an invitation
        """
        self._create_invite(self.owner_user)
        user = self.admin_user
        self.client.force_login(user)
        invitation = OrganizationInvitation.objects.get(
            invitee=self.external_user
        )

        # First cancel the invitation
        response = self.client.patch(
            self.detail_url(invitation.guid),
            data={'status': OrganizationInviteStatusChoices.CANCELLED},
        )
        assert response.status_code == status.HTTP_200_OK

        # Try to resend it
        response = self.client.patch(
            self.detail_url(invitation.guid),
            data={'status': OrganizationInviteStatusChoices.RESENT},
        )
        self.assertContains(
            response,
            'Invitation cannot be resent',
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    @data(
        ('owner', status.HTTP_200_OK),
        ('admin', status.HTTP_200_OK),
        ('member', status.HTTP_403_FORBIDDEN),
        ('external', status.HTTP_400_BAD_REQUEST)
    )
    @unpack
    def test_user_can_cancel_invitation(self, user_role, expected_status):
        """
        Test that only organization owner or admin can cancel an invitation
        """
        self._create_invite(self.owner_user)
        user = getattr(self, f'{user_role}_user')
        self.client.force_login(user)
        invitation = OrganizationInvitation.objects.get(
            invitee=self.external_user
        )
        response = self.client.patch(
            self.detail_url(invitation.guid),
            data={'status': OrganizationInviteStatusChoices.CANCELLED},
        )
        self.assertEqual(response.status_code, expected_status)
        if response.status_code == status.HTTP_200_OK:
            self.assertEqual(
                response.data['status'],
                OrganizationInviteStatusChoices.CANCELLED,
            )

            # Ensure the admin can re-invite the same user after canceling
            self.client.force_login(self.owner_user)
            response = self.client.post(
                self.list_url, data={'invitees': ['bob']}
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_invitations(self):
        """
        Test listing of invitations by the organization owner
        """
        self._create_invite(self.owner_user)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for invite in response.data['results']:
            self.assertIn('url', invite)
            self.assertIn('invitee', invite)
            self.assertIn('invited_by', invite)

        # Test that a user from another organization cannot see invitations
        self.another_owner_user = User.objects.create_user(
            username='another_owner_user',
            email='another_owner_user@example.com',
            password='password'
        )
        self.another_organization = Organization.objects.create(
            id='org1234', name='Another Organization', mmo_override=True
        )
        self.another_organization.add_user(self.another_owner_user)
        self.client.force_login(self.another_owner_user)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_registered_user_can_accept_invitation(self):
        self._create_invite(self.owner_user)
        self.client.force_login(self.external_user)
        create_asset_response = self._create_asset_by_bob()
        invitation = OrganizationInvitation.objects.get(
            invitee=self.external_user
        )
        with immediate_on_commit():
            response = self._update_invite(
                self.external_user,
                invitation.guid,
                OrganizationInviteStatusChoices.ACCEPTED,
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data['status'], OrganizationInviteStatusChoices.ACCEPTED
        )

        bob_asset = Asset.objects.get(uid=create_asset_response.data['uid'])
        self.assertEqual(bob_asset.owner, self.owner_user)
        self.assertEqual(mail.outbox[2].to[0], invitation.invited_by.email)

    def test_registered_user_can_decline_invitation(self):
        """
        Test that a registered user can decline an invitation
        """
        self._create_invite(self.owner_user)
        create_asset_response = self._create_asset_by_bob()
        self.client.force_login(self.external_user)
        invitation = OrganizationInvitation.objects.get(
            invitee=self.external_user
        )
        response = self._update_invite(
            self.external_user,
            invitation.guid,
            OrganizationInviteStatusChoices.DECLINED,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data['status'], OrganizationInviteStatusChoices.DECLINED
        )

        bob_asset = Asset.objects.get(uid=create_asset_response.data['uid'])
        self.assertEqual(bob_asset.owner, self.external_user)
        self.assertEqual(mail.outbox[2].to[0], invitation.invited_by.email)

        # Ensure the admin can re-invite the same user after declining
        self.client.force_login(self.owner_user)
        response = self.client.post(self.list_url, data={'invitees': ['bob']})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_unregistered_user_can_accept_invitation(self):
        """
        Test that an unregistered user can update their invitation status
        """
        self._create_invite(self.owner_user)
        self.new_user = User.objects.create_user(
            username='new_user',
            email='unregistereduser@example.com',
            password='new_user'
        )
        self.client.force_login(self.new_user)
        invitation = OrganizationInvitation.objects.get(
            invitee_identifier=self.new_user.email
        )
        response = self._update_invite(
            self.new_user, invitation.guid, OrganizationInviteStatusChoices.ACCEPTED
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data['status'], OrganizationInviteStatusChoices.ACCEPTED
        )
        self.assertEqual(mail.outbox[2].to[0], invitation.invited_by.email)

    @data(
        ('admin', status.HTTP_201_CREATED),
        ('member', status.HTTP_201_CREATED)
    )
    @unpack
    def test_user_invitation_by_role(self, role, expected_status):
        """
        Test that a user can be invited as an admin or member
        """
        self.invitation_data['role'] = role
        response = self._create_invite(self.owner_user)
        self.assertEqual(response.status_code, expected_status)
        self.assertEqual(
            response.data[0]['invitee_role'], role
        )
        self.client.force_login(self.external_user)
        invitation = OrganizationInvitation.objects.get(
            invitee=self.external_user
        )
        response = self._update_invite(
            self.external_user,
            invitation.guid,
            OrganizationInviteStatusChoices.ACCEPTED,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data['status'], OrganizationInviteStatusChoices.ACCEPTED
        )
        self.assertEqual(response.data['invitee_role'], role)
        self.assertEqual(
            self.organization.get_user_role(self.external_user), role
        )

    @data(
        ('owner', status.HTTP_204_NO_CONTENT),
        ('admin', status.HTTP_204_NO_CONTENT),
        ('member', status.HTTP_403_FORBIDDEN),
        ('external', status.HTTP_404_NOT_FOUND)
    )
    @unpack
    def test_owner_or_admin_can_delete_invitation(self, user_role, expected_status):
        """
        Test that the organization owner and admin can delete an invitation
        """
        self._create_invite(self.owner_user)
        user = getattr(self, f'{user_role}_user')
        self.client.force_login(user)
        invitation = OrganizationInvitation.objects.get(
            invitee=self.external_user
        )
        response = self.client.delete(self.detail_url(invitation.guid))
        self.assertEqual(response.status_code, expected_status)

    @data(
        ('owner', status.HTTP_200_OK),
        ('admin', status.HTTP_200_OK),
        ('member', status.HTTP_403_FORBIDDEN),
        ('external', status.HTTP_400_BAD_REQUEST)
    )
    @unpack
    def test_user_can_update_invitee_role(
        self, user_role, expected_status
    ):
        """
        Test that the organization owner or admin can update the role of an invitee
        """
        self._create_invite(self.owner_user)
        invitation = OrganizationInvitation.objects.get(
            invitee=self.external_user
        )
        self.assertTrue(invitation.invitee_role, ORG_MEMBER_ROLE)
        user = getattr(self, f'{user_role}_user')
        self.client.force_login(user)
        response = self.client.patch(
            self.detail_url(invitation.guid), data={'role': ORG_ADMIN_ROLE}
        )
        self.assertEqual(response.status_code, expected_status)
        if response.status_code == status.HTTP_200_OK:
            self.assertEqual(response.data['invitee_role'], ORG_ADMIN_ROLE)
            self.assertTrue(invitation.invitee_role, ORG_ADMIN_ROLE)

            # Accept the invitation
            self.client.force_login(self.external_user)
            response = self._update_invite(
                self.external_user,
                invitation.guid,
                OrganizationInviteStatusChoices.ACCEPTED,
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(
                response.data['status'],
                OrganizationInviteStatusChoices.ACCEPTED,
            )
            self.assertTrue(self.organization.is_admin(self.external_user))

            # Attempt to change the role after accepting the invitation
            self.client.force_login(user)
            response = self.client.patch(
                self.detail_url(invitation.guid), data={'role': ORG_MEMBER_ROLE}
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_config(ORGANIZATION_INVITE_EXPIRY=0)
    def test_sender_receives_expired_notification(self):
        """
        Test that the organization owner receives an email notification
        when an invitation expires
        """
        OrganizationInvitation.objects.create(
            invited_by=self.someuser,
            invitee=self.external_user,
            organization=self.organization
        )

        mark_organization_invite_as_expired()

        self.assertEqual(mail.outbox[0].to[0], self.someuser.email)
        self.assertEqual(
            mail.outbox[0].subject, 'Organization invite has expired'
        )

    @override_config(ORGANIZATION_INVITE_EXPIRY=0)
    def test_admin_can_reinvite_user_after_expired_invitation(self):
        """
        Test that an admin can re-invite a user after expiration
        """
        self._create_invite(self.owner_user)
        mark_organization_invite_as_expired()
        response = self.client.post(self.list_url, data={'invitees': ['bob']})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class OrganizationInviteValidationTestCase(BaseOrganizationInviteTestCase):

    def test_invitee_cannot_accept_invitation_twice(self):
        """
        Test that a user cannot accept an invitation that has already
        been accepted
        """
        self._create_invite(self.owner_user)
        self.client.force_login(self.external_user)
        invitation = OrganizationInvitation.objects.get(
            invitee=self.external_user
        )
        response = self._update_invite(
            self.external_user,
            invitation.guid,
            OrganizationInviteStatusChoices.ACCEPTED,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data['status'], OrganizationInviteStatusChoices.ACCEPTED
        )

        # Attempt to accept the invitation again
        response = self._update_invite(
            self.external_user,
            invitation.guid,
            OrganizationInviteStatusChoices.ACCEPTED,
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            response.data['detail'], INVITE_ALREADY_ACCEPTED_ERROR
        )

    def test_invitee_cannot_accept_if_already_member_of_organization(self):
        """
        Test that a user cannot accept an invitation if they are already a part
        of another organization
        """
        self.another_owner_user = User.objects.create_user(
            username='another_owner_user',
            email='another_owner_user@example.com',
            password='password'
        )
        self.another_admin_user = User.objects.create_user(
            username='another_admin_user',
            email='another_admin_user@example.com',
            password='password'
        )
        self.another_organization = Organization.objects.create(
            id='org1234', name='Another Organization', mmo_override=True
        )
        self.another_organization.add_user(self.another_owner_user)
        self.another_organization.add_user(
            self.another_admin_user, is_admin=True
        )
        self.invitation_data['invitees'] = [
            'another_owner_user', 'another_admin_user'
        ]
        self._create_invite(self.owner_user)

        # Attempt to accept the invitation as the owner of another organization
        self.client.force_login(self.another_owner_user)
        invitation = OrganizationInvitation.objects.get(
            invitee=self.another_owner_user
        )
        response = self._update_invite(
            self.another_owner_user,
            invitation.guid,
            OrganizationInviteStatusChoices.ACCEPTED,
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            response.data['detail'],
            replace_placeholders(
                t(INVITE_OWNER_ERROR),
                organization_name=self.another_organization.name
            )
        )

        # Attempt to accept the invitation as an admin of another organization
        self.client.force_login(self.another_admin_user)
        invitation = OrganizationInvitation.objects.get(
            invitee=self.another_admin_user
        )
        response = self._update_invite(
            self.another_admin_user,
            invitation.guid,
            OrganizationInviteStatusChoices.ACCEPTED,
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            response.data['detail'],
            replace_placeholders(
                t(INVITE_MEMBER_ERROR),
                organization_name=self.another_organization.name
            )
        )

    def test_invitee_with_different_username_cannot_accept_invitation(self):
        """
        Test that a user cannot accept an invitation with a different username
        """
        self._create_invite(self.owner_user)
        self.new_user = User.objects.create_user(
            username='new_user',
            email='new_user@example.com',
            password='password'
        )
        self.client.force_login(self.new_user)
        invitation = OrganizationInvitation.objects.get(
            invitee=self.external_user
        )
        response = self._update_invite(
            self.new_user,
            invitation.guid,
            OrganizationInviteStatusChoices.ACCEPTED,
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_invitee_with_different_email_cannot_accept_invitation(self):
        """
        Test that a user cannot accept an invitation with a different email
        """
        self._create_invite(self.owner_user)
        # Create a new user with a different email
        self.new_user = User.objects.create_user(
            username='new_user',
            email='new_user@example.com',
            password='password'
        )

        # Attempt to accept the invitation
        self.client.force_login(self.new_user)
        invitation = OrganizationInvitation.objects.get(
            invitee_identifier='unregistereduser@example.com'
        )
        response = self._update_invite(
            self.new_user,
            invitation.guid,
            OrganizationInviteStatusChoices.ACCEPTED,
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_cannot_reinvite_active_or_accepted_username(self):
        """
        Ensure that an admin cannot send a new invitation to a username if an
        active invitation already exists or has been accepted
        """
        self.client.force_login(self.owner_user)

        # Send first invitation
        response = self.client.post(self.list_url, data={'invitees': ['bob']})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Attempt to send a duplicate invitation
        response = self.client.post(self.list_url, data={'invitees': ['bob']})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertContains(
            response,
            'An active invitation already exists',
            status_code=status.HTTP_400_BAD_REQUEST
        )

        # Accept the invitation
        self.client.force_login(self.external_user)
        invitation = OrganizationInvitation.objects.get(
            invitee=self.external_user
        )
        response = self._update_invite(
            self.external_user,
            invitation.guid,
            OrganizationInviteStatusChoices.ACCEPTED,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Attempt to send a new invitation after acceptance
        self.client.force_login(self.owner_user)
        response = self.client.post(self.list_url, data={'invitees': ['bob']})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertContains(
            response,
            'User is already a member of this organization.',
            status_code=status.HTTP_400_BAD_REQUEST
        )

        # Ensure that a new invitation is not sent if the user is already
        # explicitly added to the organization
        response = self.client.post(self.list_url, data={'invitees': ['alice']})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertContains(
            response,
            'User is already a member of this organization.',
            status_code=status.HTTP_400_BAD_REQUEST
        )

    def test_admin_can_reinvite_accepted_email(self):
        """
        Ensure that an admin can send a new invitation to an email address
        after the initial invitation is accepted
        """
        self.client.force_login(self.owner_user)

        # Send first invitation
        email_invitee = 'unregistereduser@example.com'
        response = self.client.post(
            self.list_url, data={'invitees': [email_invitee]}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Attempt to send a duplicate invitation
        response = self.client.post(
            self.list_url, data={'invitees': [email_invitee]}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertContains(
            response,
            'An active invitation already exists',
            status_code=status.HTTP_400_BAD_REQUEST
        )

        # Accept the invitation
        self.new_user = User.objects.create_user(
            username='new_user', email=email_invitee
        )
        self.client.force_login(self.new_user)
        invitation = OrganizationInvitation.objects.get(
            invitee_identifier=self.new_user.email
        )
        response = self._update_invite(
            self.new_user,
            invitation.guid,
            OrganizationInviteStatusChoices.ACCEPTED
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Attempt to send a new invitation after acceptance
        self.client.force_login(self.owner_user)
        response = self.client.post(
            self.list_url, data={'invitees': [email_invitee]}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Ensure that the new invitation is sent to the same email address if
        # the user is explicitly added to the organization
        response = self.client.post(
            self.list_url, data={'invitees': ['alice@alice.com']}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_admin_can_invite_multiple_users_with_same_email(self):
        """
        Ensure that an organization admin can send invitations to an email
        associated with multiple usernames, allowing the user to choose
        which account to accept the invitation with
        """
        email_invitee = 'unregistereduser@example.com'

        first_account = User.objects.create_user(
            username='first_user', email=email_invitee
        )
        second_account = User.objects.create_user(
            username='second_user', email=email_invitee
        )

        # Send the first invitation
        self.client.force_login(self.owner_user)
        response = self.client.post(
            self.list_url, data={'invitees': [email_invitee]}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # First user accepts the invitation
        self.client.force_login(first_account)
        invitation = OrganizationInvitation.objects.get(
            invitee_identifier=first_account.email
        )
        response = self._update_invite(
            first_account,
            invitation.guid,
            OrganizationInviteStatusChoices.ACCEPTED
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['invitee'], first_account.username)

        # Send a new invitation for the same email
        self.client.force_login(self.owner_user)
        response = self.client.post(
            self.list_url, data={'invitees': [email_invitee]}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Second user accepts the invitation
        self.client.force_login(second_account)
        invitation = OrganizationInvitation.objects.filter(
            invitee_identifier=second_account.email
        ).last()
        response = self._update_invite(
            second_account,
            invitation.guid,
            OrganizationInviteStatusChoices.ACCEPTED
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['invitee'], second_account.username)
