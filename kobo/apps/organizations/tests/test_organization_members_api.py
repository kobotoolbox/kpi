from django.urls import reverse
from model_bakery import baker
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.organizations.models import Organization, OrganizationUser
from kpi.tests.kpi_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE


class OrganizationMemberAPITestCase(BaseTestCase):
    fixtures = ['test_data']
    URL_NAMESPACE = URL_NAMESPACE

    def setUp(self):
        self.organization = baker.make(
            Organization, id='org_12345', mmo_override=True
        )
        self.owner_user = baker.make(User, username='owner')
        self.member_user = baker.make(User, username='member')

        self.organization.add_user(self.owner_user)
        self.organization.add_user(self.member_user, is_admin=False)

        self.client.force_login(self.owner_user)
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

    def test_list_members(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(
            'owner',
            [member['user__username'] for member in response.data.get('results')]
        )
        self.assertIn(
            'member',
            [member['user__username'] for member in response.data.get('results')]
        )

    def test_retrieve_member_details(self):
        response = self.client.get(self.detail_url('member'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user__username'], 'member')
        self.assertEqual(response.data['role'], 'member')

    def test_update_member_role(self):
        data = {'role': 'admin'}
        response = self.client.patch(self.detail_url('member'), data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['role'], 'admin')

    def test_delete_member(self):
        response = self.client.delete(self.detail_url('member'))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        # Confirm deletion
        response = self.client.get(self.detail_url('member'))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_requires_authentication(self):
        self.client.logout()
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
