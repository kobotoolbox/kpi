# coding: utf-8
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.authtoken.models import Token

from kpi.tests.base_test_case import BaseTestCase


class UserListTests(BaseTestCase):
    fixtures = ['test_data']

    def setUp(self):
        # It uses to be in the test fixture, but it was in conflicts with Kobocat
        # code.
        token, _ = Token.objects.get_or_create(
            user__username='anotheruser',
        )
        # Cannot use `save` because it always makes INSERTs.
        Token.objects.filter(key=token.key).update(
            key='3a8da043dd1b669688dae523b015177a1d4201d5'
        )

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
        assert Token.objects.filter(user__username=self.username).exists()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        assert not Token.objects.filter(user__username=self.username).exists()

    def test_create_token_via_get(self):
        # Originally, a POST was required to generate a token, but no longer
        self.test_delete_token()
        response = self.client.get(self.url, format='json')
        self.assertEqual(
            response.data['token'],
            Token.objects.get(user__username=self.username).key
        )

    def test_create_token_via_post(self):
        # Retained for API stability
        self.test_delete_token()
        response = self.client.post(self.url, format='json')
        self.assertEqual(
            response.data['token'],
            Token.objects.get(user__username=self.username).key
        )

    def test_new_user_has_token_automatically_created(self):
        User = get_user_model()
        u = User.objects.create_user(
            username='token_test', password='token_test'
        )
        self.client.login(username='token_test', password='token_test')
        response = self.client.get(self.url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_anonymous_access_denied(self):
        self.client.logout()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_regular_user_cannot_get_token_for_another_user(self):
        response = self.client.get(self.url, {'username': 'someuser'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertNotIn('token', response.data)

    def test_superuser_can_get_token_for_another_user(self):
        self.client.logout()
        self.client.login(username='adminuser', password='pass')
        response = self.client.get(self.url, {'username': self.username})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data['token'],
            Token.objects.get(user__username=self.username).key
        )
