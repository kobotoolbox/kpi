from rest_framework import status
from rest_framework.test import APITestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.kobo_scim.models import IdentityProvider


class ScimUsersAPITests(APITestCase):

    def setUp(self):
        # Create an Identity Provider
        self.idp = IdentityProvider.objects.create(
            name='Test IdP',
            slug='test-idp',
            scim_api_key='secret-token',
            is_active=True,
        )

        self.url = f'/api/scim/v2/{self.idp.slug}/Users'

        # Create some test users
        self.user1 = User.objects.create_user(
            username='jdoe',
            email='jdoe@example.com',
            first_name='John',
            last_name='Doe',
            password='password123',
        )
        self.user2 = User.objects.create_user(
            username='asmith',
            email='asmith@example.com',
            first_name='Alice',
            last_name='Smith',
            password='password123',
        )

    def test_authentication_required(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authentication_invalid_token(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid-token')
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_successful_authentication(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_idp_slug_mismatch(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        wrong_url = '/api/scim/v2/wrong-idp/Users'
        response = self.client.get(wrong_url)
        # Assuming our view returns empty list dynamically based on viewset permissions
        # if idp doesn't match
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['totalResults'], 0)

    def test_get_users_list_format(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        self.assertIn(
            'urn:ietf:params:scim:api:messages:2.0:ListResponse', data['schemas']
        )
        self.assertEqual(data['totalResults'], 2)
        self.assertEqual(data['itemsPerPage'], 2)
        self.assertEqual(data['startIndex'], 1)

        resources = data['Resources']
        self.assertEqual(len(resources), 2)

        # Check standard SCIM fields mapping on the first user
        user1_data = next(u for u in resources if u['userName'] == 'jdoe')
        self.assertEqual(user1_data['id'], self.user1.id)
        self.assertEqual(user1_data['active'], True)
        self.assertEqual(user1_data['name']['givenName'], 'John')
        self.assertEqual(user1_data['name']['familyName'], 'Doe')
        self.assertEqual(user1_data['emails'][0]['value'], 'jdoe@example.com')
        self.assertEqual(user1_data['emails'][0]['primary'], True)

    def test_get_user_by_id(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        response = self.client.get(f'{self.url}/{self.user1.id}')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('urn:ietf:params:scim:schemas:core:2.0:User', data['schemas'])
        self.assertEqual(data['userName'], 'jdoe')
        self.assertEqual(data['active'], True)

    def test_pagination(self):
        # Create a third user
        User.objects.create_user(username='bwayne', email='bwayne@example.com')

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        # Request page 2, count 1 -> This means startIndex=2, count=1
        response = self.client.get(f'{self.url}?startIndex=2&count=1')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        self.assertEqual(data['totalResults'], 3)
        self.assertEqual(data['itemsPerPage'], 1)
        self.assertEqual(data['startIndex'], 2)
        self.assertEqual(len(data['Resources']), 1)
        self.assertEqual(
            data['Resources'][0]['userName'], 'asmith'
        )  # assuming order by id

    def test_filtering_by_username(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        response = self.client.get(f'{self.url}?filter=userName eq "jdoe"')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['totalResults'], 1)
        self.assertEqual(data['Resources'][0]['userName'], 'jdoe')

    def test_filtering_by_email(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        response = self.client.get(f'{self.url}?filter=emails eq "asmith@example.com"')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['totalResults'], 1)
        self.assertEqual(data['Resources'][0]['userName'], 'asmith')
