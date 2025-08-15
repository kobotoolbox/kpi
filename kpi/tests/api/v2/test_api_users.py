# coding: utf-8
from django.urls import reverse
from rest_framework import status

from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.base_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class UserListTests(BaseTestCase):
    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.client.login(username='adminuser', password='pass')

    def test_user_list_allowed_superuser(self):
        """
        a superuser can query the entire user list and search
        """
        response = self.client.get(self._get_list_url(), format='json')
        assert response.status_code == status.HTTP_200_OK
        self.assertIn('count', response.data)
        self.assertIn('results', response.data)
        self.assertGreater(len(response.data['results']), 0)

        # test filtering by username
        q = '?q=adminuser'
        response = self.client.get(self._get_list_url() + q, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['username'] == 'adminuser'

    def test_user_list_forbidden_non_superuser(self):
        """
        a non-superuser cannot query the entire user list
        """
        self.client.logout()
        self.client.login(username='someuser')
        response = self.client.get(self._get_list_url(), format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_list_forbidden_anonymous_user(self):
        """
        an anonymous user cannot query the entire user list
        """
        self.client.logout()
        response = self.client.get(self._get_list_url(), format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_page_succeeds(self):
        """
        we can retrieve user details
        """
        username = 'adminuser'
        response = self.client.get(self._get_detail_url(username), format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('username', response.data)
        self.assertEqual(response.data['username'], username)

    def test_invalid_user_fails(self):
        """
        verify that a 404 is returned when trying to retrieve details for an
        invalid user
        """
        response = self.client.get(
            self._get_detail_url('nonexistentuser'), format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_list_pagination_limit(self):
        """
        Test that pagination works with the 'limit' parameter.
        """
        url = self._get_list_url()
        response = self.client.get(f'{url}?limit=1', format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertIsNotNone(response.data['next'])
        self.assertIsNone(response.data['previous'])

        response = self.client.get(f'{url}?limit=100', format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], len(response.data['results']))
        self.assertIsNone(response.data['next'])
        self.assertIsNone(response.data['previous'])

    def test_user_list_pagination_start(self):
        """
        Test that pagination works with the 'start' parameter.
        """
        # Create more users to ensure pagination has enough data
        for i in range(5):
            User.objects.create_user(
                username=f'paginateduser{i}',
                email=f'paginated{i}@example.com',
                password='pass',
            )

        url = self._get_list_url()
        response = self.client.get(f'{url}?start=1&limit=1', format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        # Verify the user is not the first one
        first_user_in_fixture = User.objects.order_by('id').first()
        self.assertNotEqual(
            response.data['results'][0]['username'], first_user_in_fixture.username
        )

    def test_user_list_serializer_fields(self):
        """
        Verify that the UserListSerializer returns all expected fields
        """
        url = self._get_list_url()
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        first_user_data = response.data['results'][0]

        expected_fields = [
            'extra_details__uid',
            'username',
            'first_name',
            'last_name',
            'email',
            'is_superuser',
            'is_staff',
            'is_active',
            'date_joined',
            'last_login',
            'validated_email',
            'validated_password',
            'mfa_is_active',
            'sso_is_active',
            'accepted_tos',
            'social_accounts',
            'organizations',
            'metadata',
            'subscriptions',
            'current_service_usage',
            'asset_count',
            'deployed_asset_count',
        ]
        for field in expected_fields:
            self.assertIn(field, first_user_data)

    def _get_detail_url(self, username):
        return reverse(self._get_endpoint('user-kpi-detail'), args=[username])

    def _get_list_url(self):
        return reverse(self._get_endpoint('user-kpi-list'))
