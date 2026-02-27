from allauth.socialaccount.models import SocialAccount, SocialApp
from rest_framework import status
from rest_framework.test import APITestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.kobo_scim.models import IdentityProvider


class ScimUsersAPITests(APITestCase):

    def setUp(self):
        # Create a SocialApp mapping
        self.social_app = SocialApp.objects.create(
            provider='openid_connect',
            provider_id='test-provider-id',
            name='Test Provider',
            client_id='test-client-id',
        )

        # Create an Identity Provider
        self.idp = IdentityProvider.objects.create(
            name='Test IdP',
            slug='test-idp',
            scim_api_key='secret-token',
            is_active=True,
            social_app=self.social_app,
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

        # Link the users to the IdP's social app provider
        SocialAccount.objects.create(
            user=self.user1, provider=self.social_app.provider_id, uid='jdoe-uid'
        )
        SocialAccount.objects.create(
            user=self.user2, provider=self.social_app.provider_id, uid='asmith-uid'
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
        user3 = User.objects.create_user(username='bwayne', email='bwayne@example.com')
        SocialAccount.objects.create(
            user=user3, provider=self.social_app.provider_id, uid='bwayne-uid'
        )

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

    def test_delete_user_deactivates_all_matching_emails(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        # Create another user with the same email as user1 (jdoe@example.com)
        user3 = User.objects.create_user(
            username='jdoe_sso',
            email='jdoe@example.com',
            first_name='John',
            last_name='Doe',
            is_active=True,
        )

        response = self.client.delete(f'{self.url}/{self.user1.id}')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify that both users with the same email are deactivated
        self.user1.refresh_from_db()
        user3.refresh_from_db()
        self.assertFalse(self.user1.is_active)
        self.assertFalse(user3.is_active)

        # Verify user2 (different email) is still active
        self.user2.refresh_from_db()
        self.assertTrue(self.user2.is_active)

    def test_delete_user_without_email_deactivates_only_that_user(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        user_no_email = User.objects.create_user(
            username='noemail',
            first_name='No',
            last_name='Email',
            is_active=True,
        )
        SocialAccount.objects.create(
            user=user_no_email, provider=self.social_app.provider_id, uid='noemail-uid'
        )

        # Also ensure user1 is active
        self.assertTrue(self.user1.is_active)

        response = self.client.delete(f'{self.url}/{user_no_email.id}')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        user_no_email.refresh_from_db()
        self.assertFalse(user_no_email.is_active)

        # Verify user1 is not affected
        self.user1.refresh_from_db()
        self.assertTrue(self.user1.is_active)

    def test_delete_user_wrong_idp(self):
        # Create a second Identity Provider and SocialApp
        social_app_2 = SocialApp.objects.create(
            provider='other_provider',
            provider_id='other-provider-id',
            name='Other Provider',
            client_id='other-client-id',
        )

        idp_2 = IdentityProvider.objects.create(
            name='Other IdP',
            slug='other-idp',
            scim_api_key='other-secret-token',
            is_active=True,
            social_app=social_app_2,
        )

        # We try to use idp_2's credentials to delete user1
        # (user1 is linked to the first IdP)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {idp_2.scim_api_key}')

        url_2 = f'/api/scim/v2/{idp_2.slug}/Users'
        response = self.client.delete(f'{url_2}/{self.user1.id}')

        # The queryset filtering prevents idp_2 from seeing user1, so it should 404
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Verify user1 is not affected
        self.user1.refresh_from_db()
        self.assertTrue(self.user1.is_active)

    def test_patch_deactivate_user(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        # Create another user with the same email as user1 (jdoe@example.com)
        user3 = User.objects.create_user(
            username='jdoe_sso',
            email='jdoe@example.com',
            first_name='John',
            last_name='Doe',
            is_active=True,
        )

        payload = {
            'schemas': ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
            'Operations': [{'op': 'replace', 'path': 'active', 'value': False}],
        }

        response = self.client.patch(
            f'{self.url}/{self.user1.id}', payload, format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertFalse(data.get('active', True))

        # Verify that both users with the same email are deactivated
        self.user1.refresh_from_db()
        user3.refresh_from_db()
        self.assertFalse(self.user1.is_active)
        self.assertFalse(user3.is_active)

    def test_patch_unsupported_operation(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        payload = {
            'schemas': ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
            'Operations': [
                {'op': 'replace', 'path': 'name.familyName', 'value': 'Smith'}
            ],
        }

        response = self.client.patch(
            f'{self.url}/{self.user1.id}', payload, format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        self.user1.refresh_from_db()
        self.assertTrue(self.user1.is_active)
