from ddt import ddt, data, unpack
from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.tests.test_organizations_api import (
    BaseOrganizationAssetApiTestCase
)
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

    def _create_invite(self, user):
        """
        Helper method to create and accept invitations
        """
        invitation_data = {
            'invitees': ['registered_invitee', 'unregistered_invitee@test.com']
        }
        list_url = reverse(
            self._get_endpoint('organization-invites-list'),
            kwargs={'organization_id': self.organization.id},
        )
        self.client.force_login(user)
        self.client.post(list_url, data=invitation_data)

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

        # Check if the invite data is present for invitees
        if response.status_code == status.HTTP_200_OK:
            for result in response.data.get('results'):
                self.assertIn('invite', result)
                if result['user__username'] in [
                    'registered_invitee', 'unregistered_invitee'
                ]:
                    self.assertIn('url', result['invite'])
                    self.assertIn('invited_by', result['invite'])
                    self.assertIn('status', result['invite'])
                    self.assertIn('invitee_role', result['invite'])
                    self.assertIn('invitee', result['invite'])
                    self.assertEqual(result['invite']['status'], 'pending')
                    self.assertEqual(result['invite']['invitee_role'], 'member')

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
        response = self.client.delete(self.detail_url(self.member_user))
        self.assertEqual(response.status_code, expected_status)
        if expected_status == status.HTTP_204_NO_CONTENT:
            # Confirm deletion
            response = self.client.get(self.detail_url(self.member_user))
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
            self.assertFalse(
                User.objects.filter(username=f'{user_role}_user').exists()
            )

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
