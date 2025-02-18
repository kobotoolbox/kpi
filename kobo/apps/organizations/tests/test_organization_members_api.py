from ddt import ddt, data, unpack
from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
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
            user = getattr(self, f'{user_role}_user')
            self.client.force_login(user)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, expected_status)

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
