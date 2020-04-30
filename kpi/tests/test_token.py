# coding: utf-8
from django.urls import reverse
from rest_framework import status
from rest_framework.authtoken.models import Token

from kpi.tests.base_test_case import BaseTestCase


class UserListTests(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        # This user has a pre-made token in the test fixture
        self.username = 'anotheruser'
        self.client.login(username='anotheruser', password='anotheruser')
        self.url = reverse('token')

    def test_get_existing_token(self):
        response = self.client.get(self.url, format='json')
        self.assertEqual(
            response.data['token'],
            '3a8da043dd1b669688dae523b015177a1d4201d5'
        )

    def test_delete_token(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_token(self):
        self.test_delete_token()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        response = self.client.post(self.url, format='json')
        self.assertEqual(
            response.data['token'],
            Token.objects.get(user__username=self.username).key
        )

    def test_anonymous_access_denied(self):
        self.client.logout()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_regular_user_cannot_get_token_for_another_user(self):
        response = self.client.get(self.url, {'username': 'someuser'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertNotIn('token', response.data)

    def test_superuser_can_get_token_for_another_user(self):
        self.client.logout()
        self.client.login(username='admin', password='pass')
        response = self.client.get(self.url, {'username': self.username})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data['token'],
            Token.objects.get(user__username=self.username).key
        )
