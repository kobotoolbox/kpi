from rest_framework.test import APITestCase
from django.core.urlresolvers import reverse
from rest_framework import status

class UserListTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='admin', password='pass')

    def test_user_list_succeeds(self):
        """
        we can query for user list
        """
        url = reverse('user-list')
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_user_page_succeeds(self):
        """
        we can query for user list
        """
        url = reverse('user-detail', args=['admin'])
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_invalid_user_fails(self):
        """
        we can query for user list
        """
        url = reverse('user-detail', args=['nonexistentuser'])
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
