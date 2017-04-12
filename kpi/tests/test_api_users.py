from rest_framework.test import APITestCase
from django.core.urlresolvers import reverse
from rest_framework import status

class UserListTests(APITestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.client.login(username='admin', password='pass')

    def test_user_list_forbidden(self):
        """
        we cannot query the entire user list
        """
        url = reverse('user-list')
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_page_succeeds(self):
        """
        we can retrieve user details
        """
        username = 'admin'
        url = reverse('user-detail', args=[username])
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('username', response.data)
        self.assertEqual(response.data['username'], username)

    def test_invalid_user_fails(self):
        """
        verify that a 404 is returned when trying to retrieve details for an
        invalid user
        """
        url = reverse('user-detail', args=['nonexistentuser'])
        response = self.client.get(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
