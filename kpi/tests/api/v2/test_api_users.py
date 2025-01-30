# coding: utf-8
from django.urls import reverse
from rest_framework import status

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
        url = reverse(self._get_endpoint('user-kpi-list'))
        response = self.client.get(url, format='json')
        assert response.status_code == status.HTTP_200_OK

        # test filtering by username
        q = '?q=adminuser'
        response = self.client.get(url + q, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['username'] == 'adminuser'

    def test_user_list_forbidden_non_superuser(self):
        """
        a non-superuser cannot query the entire user list
        """
        self.client.logout()
        self.client.login(username='someuser')
        url = reverse(self._get_endpoint('user-kpi-list'))
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_list_forbidden_anonymous_user(self):
        """
        an anonymous user cannot query the entire user list
        """
        self.client.logout()
        url = reverse(self._get_endpoint('user-kpi-list'))
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_page_succeeds(self):
        """
        we can retrieve user details
        """
        username = 'adminuser'
        url = reverse(self._get_endpoint('user-kpi-detail'), args=[username])
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('username', response.data)
        self.assertEqual(response.data['username'], username)

    def test_invalid_user_fails(self):
        """
        verify that a 404 is returned when trying to retrieve details for an
        invalid user
        """
        url = reverse(self._get_endpoint('user-kpi-detail'), args=['nonexistentuser'])
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
