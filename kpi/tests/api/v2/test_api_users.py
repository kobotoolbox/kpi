# coding: utf-8
from django.urls import reverse
from rest_framework import status

from kpi.tests.base_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class UserListTests(BaseTestCase):
    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.client.login(username='admin', password='pass')

    def test_user_list_forbidden(self):
        """
        we cannot query the entire user list
        """
        url = reverse(self._get_endpoint('user-list'))
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_page_succeeds(self):
        """
        we can retrieve user details
        """
        username = 'admin'
        url = reverse(self._get_endpoint('user-detail'), args=[username])
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('username', response.data)
        self.assertEqual(response.data['username'], username)

    def test_invalid_user_fails(self):
        """
        verify that a 404 is returned when trying to retrieve details for an
        invalid user
        """
        url = reverse(self._get_endpoint('user-detail'), args=['nonexistentuser'])
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
