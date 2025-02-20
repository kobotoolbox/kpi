from ddt import ddt, data, unpack
from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import (
    OrganizationInvitation,
    OrganizationInviteStatusChoices
)
from kobo.apps.organizations.tests.test_organizations_api import (
    BaseOrganizationAssetApiTestCase
)
from kpi.constants import PERM_MANAGE_ASSET
from kpi.models import Asset
from kpi.urls.router_api_v2 import URL_NAMESPACE


@ddt
class OrganizationMemberAPITestCase(BaseOrganizationAssetApiTestCase):
    fixtures = ['test_data']
    URL_NAMESPACE = URL_NAMESPACE

    def setUp(self):
        super().setUp()
        self.organization = self.someuser.organization
        self.owner_user = self.someuser
        self.member_user = self.alice
        self.admin_user = self.anotheruser
        self.external_user = self.bob
        self.registered_invitee_user = User.objects.create_user(
            username='registered_invitee', email='registered_invitee@test.com',
        )

        # Create an asset owned by the organization member
        asset_response = self._create_asset_by_alice()
        self.asset = Asset.objects.get(uid=asset_response.data['uid'])

        self.list_url = reverse(
            self._get_endpoint('organization-members-list'),
            kwargs={'organization_id': self.organization.id},
        )
        self.detail_url = lambda username: reverse(
            self._get_endpoint('organization-members-detail'),
            kwargs={
                'organization_id': self.organization.id,
                'user__username': username
            },
        )

    def _create_invite(self, invited_by: 'User', invitees=None):
        """
        Helper method to create and accept invitations
        """
        if not invitees:
            invitation_data = {
                'invitees': ['registered_invitee', 'unregistered_invitee@test.com']
            }
        else:
            invitation_data = {'invitees': invitees}

        list_url = reverse(
            self._get_endpoint('organization-invites-list'),
            kwargs={'organization_id': self.organization.id},
        )
        self.client.force_login(invited_by)
        self.client.post(list_url, data=invitation_data)

    def _update_invite(self, user, guid, status):
        """
        Helper method to update invitation status
        """
        detail_url = reverse(
            self._get_endpoint('organization-invites-detail'),
            kwargs={
                'guid': guid, 'organization_id': self.organization.id
            }
        )
        self.client.force_login(user)
        return self.client.patch(detail_url, data={'status': status})

    @data(
        ('owner', status.HTTP_200_OK),
        ('admin', status.HTTP_200_OK),
        ('member', status.HTTP_200_OK),
        ('external', status.HTTP_404_NOT_FOUND),
        ('anonymous', status.HTTP_401_UNAUTHORIZED),
    )
    @unpack
    def test_list_members_with_different_roles(self, user_role, expected_status):
        if user_role == 'anonymous':
            self.client.logout()
        else:
            self._create_invite(self.someuser)
            user = getattr(self, f'{user_role}_user')
            self.client.force_login(user)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, expected_status)

        if response.status_code != status.HTTP_200_OK:
            return

        # Expected user count (owner, admin, member and invitees)
        expected_users = 5
        expected_invite_keys = {
            'url', 'invited_by', 'status', 'invitee_role', 'organization_name',
            'created', 'modified',  'invitee'
        }

        # Check if the invite data is present for invitees
        self.assertEqual(len(response.data.get('results')), expected_users)

        for result in response.data.get('results'):
            self.assertIn('invite', result)
            if result['invite']:
                # Check if the invite contains exactly the expected keys
                self.assertEqual(
                    set(result['invite'].keys()), expected_invite_keys
                )

                # Ensure the details are not revealed for unregistered invitees
                if result['invite']['invitee'] in [
                    'registered_invitee', 'unregistered_invitee@test.com'
                ]:
                    self.assertEqual(result['user__username'], None)
                    self.assertEqual(result['user__has_mfa_enabled'], None)
                    self.assertEqual(result['role'], None)
                else:
                    self.assertIn(
                        result['user__username'],
                        ['someuser', 'anotheruser', 'alice']
                    )

    @data(
        ('owner', status.HTTP_200_OK),
        ('admin', status.HTTP_200_OK),
        ('member', status.HTTP_200_OK),
        ('external', status.HTTP_404_NOT_FOUND),
        ('anonymous', status.HTTP_401_UNAUTHORIZED),
    )
    @unpack
    def test_retrieve_member_details_with_different_roles(
            self, user_role, expected_status
    ):
        if user_role == 'anonymous':
            self.client.logout()
        else:
            user = getattr(self, f'{user_role}_user')
            self.client.force_login(user)
        response = self.client.get(self.detail_url(self.member_user))
        self.assertEqual(response.status_code, expected_status)

    @data(
        ('owner', status.HTTP_200_OK),
        ('admin', status.HTTP_200_OK),
        ('member', status.HTTP_403_FORBIDDEN),
        ('external', status.HTTP_404_NOT_FOUND),
        ('anonymous', status.HTTP_401_UNAUTHORIZED),
    )
    @unpack
    def test_update_member_role_with_different_roles(self, user_role, expected_status):
        if user_role == 'anonymous':
            self.client.logout()
        else:
            user = getattr(self, f'{user_role}_user')
            self.client.force_login(user)
        data = {'role': 'admin'}
        response = self.client.patch(self.detail_url(self.member_user), data)
        self.assertEqual(response.status_code, expected_status)

    @data(
        ('owner', status.HTTP_204_NO_CONTENT),
        ('admin', status.HTTP_204_NO_CONTENT),
        ('member', status.HTTP_403_FORBIDDEN),
        ('external', status.HTTP_404_NOT_FOUND),
        ('anonymous', status.HTTP_401_UNAUTHORIZED),
    )
    @unpack
    def test_delete_member_with_different_roles(self, user_role, expected_status):
        if user_role == 'anonymous':
            self.client.logout()
        else:
            user = getattr(self, f'{user_role}_user')
            self.client.force_login(user)

        assert self.asset.has_perm(self.member_user, PERM_MANAGE_ASSET)
        response = self.client.delete(self.detail_url(self.member_user))
        self.assertEqual(response.status_code, expected_status)
        if expected_status == status.HTTP_204_NO_CONTENT:
            # Confirm deletion
            response = self.client.get(self.detail_url(self.member_user))
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
            self.assertFalse(
                User.objects.filter(username=f'{user_role}_user').exists()
            )

            # Confirm asset permissions are revoked
            assert not self.asset.get_perms(self.member_user)

    @data(
        ('owner', status.HTTP_405_METHOD_NOT_ALLOWED),
        ('admin', status.HTTP_405_METHOD_NOT_ALLOWED),
        ('member', status.HTTP_403_FORBIDDEN),
        ('external', status.HTTP_404_NOT_FOUND),
        ('anonymous', status.HTTP_401_UNAUTHORIZED),
    )
    @unpack
    def test_post_request_is_not_allowed(self, user_role, expected_status):
        if user_role == 'anonymous':
            self.client.logout()
        else:
            user = getattr(self, f'{user_role}_user')
            self.client.force_login(user)
        data = {'role': 'admin'}
        response = self.client.post(self.list_url, data)
        self.assertEqual(response.status_code, expected_status)

    def test_invitation_is_correctly_assigned_in_member_list(self):

        bob_org = self.bob.organization
        bob_org.mmo_override = True
        bob_org.save(update_fields=['mmo_override'])

        # Let someuser invite bob to join their org
        self._create_invite(invited_by=self.someuser, invitees=['bob'])

        # Look at bob's membership detail endpoint in bob's org,
        # someuser's invite should not be there
        self.client.force_login(self.bob)
        bob_org_members_list_url = reverse(
            self._get_endpoint('organization-members-list'),
            kwargs={'organization_id': bob_org.id},
        )
        response = self.client.get(bob_org_members_list_url)
        # The first member should be bob
        assert response.data['results'][0]['user__username'] == 'bob'
        assert response.data['results'][0]['invite'] == {}

        # Look at bob's membership detail endpoint in someother's org,
        # someuser's invite should **BE** there
        self.client.force_login(self.someuser)
        someuser_org_members_list_url = reverse(
            self._get_endpoint('organization-members-list'),
            kwargs={'organization_id': self.organization.id},
        )
        response = self.client.get(someuser_org_members_list_url)

        # The last invite should be bob's one
        assert response.data['results'][-1]['invite']['invitee'] == 'bob'
        assert (
            response.data['results'][-1]['invite']['status']
            == OrganizationInviteStatusChoices.PENDING
        )

    def test_invite_details_clear_after_user_removal(self):
        """
        Ensure invite details are only available while the user is part of an
        organization
        """
        # 1. Create an invite for the registered invitee
        self._create_invite(self.someuser)

        # 2. Accept the invite and ensure the user is added to the organization
        self.client.force_login(self.registered_invitee_user)
        invitation = OrganizationInvitation.objects.get(
            invitee=self.registered_invitee_user
        )
        response = self._update_invite(
            self.registered_invitee_user,
            invitation.guid,
            OrganizationInviteStatusChoices.ACCEPTED,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # 3. Verify that invite details are present for the user
        self.client.force_login(self.someuser)
        response = self.client.get(self.detail_url(self.registered_invitee_user))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['invite']['invitee'], 'registered_invitee')

        # 4. Remove the user from the organization
        self.client.delete(self.detail_url(self.registered_invitee_user))

        # 5. Verify that the removed user is no longer retrievable
        response = self.client.get(self.detail_url(self.registered_invitee_user))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # 6. Verify that previous invite details are not retained
        self.client.force_login(self.registered_invitee_user)
        self.organization = self.registered_invitee_user.organization
        response = self.client.get(self.detail_url(self.registered_invitee_user))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['invite'], {})
