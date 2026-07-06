from allauth.socialaccount.models import SocialAccount, SocialApp
from constance.test import override_config
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from hub.models.extra_user_detail import ExtraUserDetail
from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.kobo_scim.constants import (
    SCIM_SCHEMA_EXTENSION_USER,
    SCIM_SCHEMA_LIST_RESPONSE,
    SCIM_SCHEMA_PATCH_OP,
    SCIM_SCHEMA_USER,
)
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

        self.url = reverse(
            'api_v2:kobo_scim:scim-users-list', kwargs={'idp_slug': self.idp.slug}
        )

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
        response = self.client.get(self.url, HTTP_ACCEPT='application/scim+json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authentication_invalid_token(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid-token')
        response = self.client.get(self.url, HTTP_ACCEPT='application/scim+json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_successful_authentication(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        response = self.client.get(self.url, HTTP_ACCEPT='application/scim+json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_idp_slug_mismatch(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        wrong_url = reverse(
            'api_v2:kobo_scim:scim-users-list', kwargs={'idp_slug': 'wrong-idp'}
        )
        response = self.client.get(wrong_url, HTTP_ACCEPT='application/scim+json')
        # Assuming our view returns empty list dynamically based on viewset permissions
        # if idp doesn't match
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['totalResults'], 0)

    def test_get_users_list_format(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        response = self.client.get(self.url, HTTP_ACCEPT='application/scim+json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        self.assertIn(SCIM_SCHEMA_LIST_RESPONSE, data['schemas'])
        self.assertEqual(data['totalResults'], 2)
        self.assertEqual(data['itemsPerPage'], 2)
        self.assertEqual(data['startIndex'], 1)

        resources = data['Resources']
        self.assertEqual(len(resources), 2)

        # Check standard SCIM fields mapping on the first user
        user1_data = next(u for u in resources if u['userName'] == 'jdoe')
        self.assertEqual(user1_data['id'], str(self.user1.id))
        self.assertEqual(user1_data['active'], True)
        self.assertEqual(user1_data['name']['givenName'], 'John')
        self.assertEqual(user1_data['name']['familyName'], 'Doe')
        self.assertEqual(user1_data['emails'][0]['value'], 'jdoe@example.com')
        self.assertEqual(user1_data['emails'][0]['primary'], True)

    def test_create_user_success(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        payload = {
            'schemas': [SCIM_SCHEMA_USER],
            'userName': 'newscimuser',
            'name': {
                'givenName': 'New',
                'familyName': 'Scim',
                'formatted': 'New Scim User',
            },
            'emails': [
                {'primary': True, 'value': 'newscimuser@example.com', 'type': 'work'}
            ],
            'active': True,
        }

        response = self.client.post(
            self.url,
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )

        self.assertEqual(
            response.status_code, status.HTTP_201_CREATED, response.content
        )
        data = response.json()
        self.assertEqual(data['userName'], 'newscimuser')
        self.assertEqual(data['name']['formatted'], 'New Scim User')
        self.assertEqual(data['name']['givenName'], 'New')
        self.assertEqual(data['name']['familyName'], 'Scim')

        # Verify in DB
        user = User.objects.get(username='newscimuser')
        self.assertEqual(user.email, 'newscimuser@example.com')
        self.assertEqual(user.first_name, 'New')
        self.assertEqual(user.last_name, 'Scim')

        extra_user_detail = ExtraUserDetail.objects.get(user=user)
        self.assertEqual(extra_user_detail.data.get('name'), 'New Scim User')

        # Verify SocialAccount link
        social_account = SocialAccount.objects.get(
            user=user, provider=self.idp.social_app.provider_id
        )
        self.assertIsNotNone(social_account)

    def test_create_user_unique_username_generator(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        # User 1 provisions with username 'johndoe' and externalId 'john1'
        payload1 = {
            'schemas': [SCIM_SCHEMA_USER],
            'userName': 'johndoe',
            'externalId': 'john1',
            'emails': [{'primary': True, 'value': 'john1@example.com'}],
            'active': True,
        }
        resp1 = self.client.post(
            self.url, payload1, format='json', HTTP_ACCEPT='application/scim+json'
        )
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp1.json()['userName'], 'johndoe')

        # User 2 (different email/externalId) provisions
        # with the same username 'johndoe'
        payload2 = {
            'schemas': [SCIM_SCHEMA_USER],
            'userName': 'johndoe',
            'externalId': 'john2',
            'emails': [{'primary': True, 'value': 'john2@example.com'}],
            'active': True,
        }
        resp2 = self.client.post(
            self.url, payload2, format='json', HTTP_ACCEPT='application/scim+json'
        )
        self.assertEqual(resp2.status_code, status.HTTP_201_CREATED)

        # It should generate a unique username by appending the IdP slug
        self.assertEqual(resp2.json()['userName'], f'johndoe_{self.idp.slug}')

        # User 3 (another different email/externalId) provisions
        # with the same username 'johndoe'
        payload3 = {
            'schemas': [SCIM_SCHEMA_USER],
            'userName': 'johndoe',
            'externalId': 'john3',
            'emails': [{'primary': True, 'value': 'john3@example.com'}],
            'active': True,
        }
        resp3 = self.client.post(
            self.url, payload3, format='json', HTTP_ACCEPT='application/scim+json'
        )
        self.assertEqual(resp3.status_code, status.HTTP_201_CREATED)

        # It should append a number since the {username}_{idp_slug} is also taken
        self.assertEqual(resp3.json()['userName'], f'johndoe_{self.idp.slug}_1')

    def test_create_user_unique_username_different_idps(self):
        # Create a second IdP
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
        url_2 = reverse(
            'api_v2:kobo_scim:scim-users-list',
            kwargs={'idp_slug': idp_2.slug},
        )

        # Provision from IdP 1
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        payload1 = {
            'schemas': [SCIM_SCHEMA_USER],
            'userName': 'jane',
            'emails': [{'primary': True, 'value': 'jane1@example.com'}],
            'active': True,
        }
        resp1 = self.client.post(
            self.url, payload1, format='json', HTTP_ACCEPT='application/scim+json'
        )
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp1.json()['userName'], 'jane')

        # Provision from IdP 2 with the same username
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {idp_2.scim_api_key}')
        payload2 = {
            'schemas': [SCIM_SCHEMA_USER],
            'userName': 'jane',
            'emails': [{'primary': True, 'value': 'jane2@example.com'}],
            'active': True,
        }
        resp2 = self.client.post(
            url_2, payload2, format='json', HTTP_ACCEPT='application/scim+json'
        )
        self.assertEqual(resp2.status_code, status.HTTP_201_CREATED)

        # It should generate a unique username by appending the second IdP slug
        self.assertEqual(resp2.json()['userName'], f'jane_{idp_2.slug}')

    def test_create_user_existing_email_aborts_with_conflict(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        User.objects.create_user(
            username='existing_local',
            email='existing_match@example.com',
        )

        payload = {
            'schemas': [SCIM_SCHEMA_USER],
            'userName': 'idp_username',
            'emails': [{'primary': True, 'value': 'existing_match@example.com'}],
            'active': True,
        }

        response = self.client.post(
            self.url,
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )

        self.assertEqual(
            response.status_code, status.HTTP_409_CONFLICT, response.content
        )

        self.assertFalse(
            SocialAccount.objects.filter(
                provider=self.idp.social_app.provider_id,
                uid='idp_username',
            ).exists()
        )

    def test_create_user_reactivates_existing_inactive_user(self):
        # A previously de-provisioned user gets re-assigned to the Kobo App
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        # User already exists and is deactivated
        deactivated_user = User.objects.create_user(
            username='rejoined_user',
            email='rejoined@example.com',
            is_active=False,
        )
        SocialAccount.objects.create(
            user=deactivated_user,
            provider=self.social_app.provider_id,
            uid='rejoined_user',
        )

        payload = {
            'schemas': [SCIM_SCHEMA_USER],
            'userName': 'rejoined_user',
            'emails': [{'primary': True, 'value': 'rejoined@example.com'}],
            'active': True,
        }

        response = self.client.post(
            self.url,
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )

        self.assertEqual(
            response.status_code, status.HTTP_201_CREATED, response.content
        )

        # Verify the user was NOT duplicated
        self.assertEqual(User.objects.filter(username='rejoined_user').count(), 1)

        # Verify the user was reactivated
        deactivated_user.refresh_from_db()
        self.assertTrue(deactivated_user.is_active)

    def test_get_user_by_id(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        response = self.client.get(
            f'{self.url}/{self.user1.id}', HTTP_ACCEPT='application/scim+json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn(SCIM_SCHEMA_USER, data['schemas'])
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
        response = self.client.get(
            f'{self.url}?startIndex=2&count=1',
            HTTP_ACCEPT='application/scim+json',
        )
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
        response = self.client.get(
            f'{self.url}?filter=userName eq "jdoe"',
            HTTP_ACCEPT='application/scim+json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['totalResults'], 1)
        self.assertEqual(data['Resources'][0]['userName'], 'jdoe')

    def test_filtering_by_email(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        response = self.client.get(
            f'{self.url}?filter=emails eq "asmith@example.com"',
            HTTP_ACCEPT='application/scim+json',
        )

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

        response = self.client.delete(
            f'{self.url}/{self.user1.id}', HTTP_ACCEPT='application/scim+json'
        )

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

        response = self.client.delete(
            f'{self.url}/{user_no_email.id}',
            HTTP_ACCEPT='application/scim+json',
        )

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

        url_2 = reverse(
            'api_v2:kobo_scim:scim-users-list',
            kwargs={'idp_slug': idp_2.slug},
        )
        response = self.client.delete(
            f'{url_2}/{self.user1.id}', HTTP_ACCEPT='application/scim+json'
        )

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
            'schemas': [SCIM_SCHEMA_PATCH_OP],
            'Operations': [{'op': 'replace', 'path': 'active', 'value': False}],
        }

        response = self.client.patch(
            f'{self.url}/{self.user1.id}',
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertFalse(data.get('active', True))

        # Verify that both users with the same email are deactivated
        self.user1.refresh_from_db()
        user3.refresh_from_db()
        self.assertFalse(self.user1.is_active)
        self.assertFalse(user3.is_active)

    def test_patch_name_operation(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        payload = {
            'schemas': [SCIM_SCHEMA_PATCH_OP],
            'Operations': [
                {'op': 'replace', 'path': 'name.familyName', 'value': 'Smith'}
            ],
        }

        response = self.client.patch(
            f'{self.url}/{self.user1.id}',
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.user1.refresh_from_db()
        self.assertEqual(self.user1.last_name, 'Smith')

    def test_patch_unsupported_operation(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        payload = {
            'schemas': [SCIM_SCHEMA_PATCH_OP],
            'Operations': [
                {'op': 'replace', 'path': 'unknownField', 'value': 'x'}
            ],
        }

        response = self.client.patch(
            f'{self.url}/{self.user1.id}',
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = response.json()
        self.assertEqual(data.get('detail'), 'Operation not supported or invalid')

    def test_put_name_operation(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        payload = {
            'schemas': [SCIM_SCHEMA_USER],
            'userName': 'jdoe',
            'name': {
                'givenName': 'Johnny',
                'familyName': 'Doeseph',
                'formatted': 'Johnny Doeseph',
            },
            'emails': [{'primary': True, 'value': 'jdoe@example.com', 'type': 'work'}],
            'active': True,
        }

        response = self.client.put(
            f'{self.url}/{self.user1.id}',
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.user1.refresh_from_db()
        self.assertEqual(self.user1.first_name, 'Johnny')
        self.assertEqual(self.user1.last_name, 'Doeseph')

        extra_user_detail = ExtraUserDetail.objects.get(user=self.user1)
        self.assertEqual(extra_user_detail.data.get('name'), 'Johnny Doeseph')

    def test_manual_reactivation_after_scim_deprovisioning(self):
        """
        Test that a superuser can manually reactivate a user after SCIM deprovisioning.
        """
        # SCIM deprovisioning request
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        response = self.client.delete(
            f'{self.url}/{self.user1.id}', HTTP_ACCEPT='application/scim+json'
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        self.user1.refresh_from_db()
        self.assertFalse(self.user1.is_active)

        # Superuser manually reactivates user1
        self.user1.is_active = True
        self.user1.save()

        self.user1.refresh_from_db()
        self.assertTrue(self.user1.is_active)

    def test_scim_deprovisioning_is_idempotent(self):
        """
        Test that multiple SCIM deprovisioning requests for the same user are
        idempotent. Ensure that if multiple deprovisioning requests are received
        for the same email, the user is deactivated after the first request, and
        subsequent requests do not cause errors or additional deactivations.
        """
        # First deprovisioning request
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        response1 = self.client.delete(
            f'{self.url}/{self.user1.id}', HTTP_ACCEPT='application/scim+json'
        )
        self.assertEqual(response1.status_code, status.HTTP_204_NO_CONTENT)

        self.user1.refresh_from_db()
        self.assertFalse(self.user1.is_active)

        logs_after_first = AuditLog.objects.filter(
            object_id=self.user1.id,
            action=AuditAction.DEACTIVATION,
        ).count()
        self.assertEqual(logs_after_first, 1)

        # Second deprovisioning request (simulating IdP resending the event)
        response2 = self.client.delete(
            f'{self.url}/{self.user1.id}', HTTP_ACCEPT='application/scim+json'
        )
        self.assertEqual(response2.status_code, status.HTTP_204_NO_CONTENT)

        # Verify Bob is still inactive
        self.user1.refresh_from_db()
        self.assertFalse(self.user1.is_active)

        logs_after_second = AuditLog.objects.filter(
            object_id=self.user1.id,
            action=AuditAction.DEACTIVATION,
        ).count()
        # Both requests will be logged
        self.assertEqual(logs_after_second, 2)

    def test_subsequent_scim_request_deactivates_after_manual_reactivation(self):
        # First deprovisioning
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        self.client.delete(
            f'{self.url}/{self.user1.id}', HTTP_ACCEPT='application/scim+json'
        )
        self.user1.refresh_from_db()
        self.assertFalse(self.user1.is_active)

        # Manual reactivation by superuser
        self.user1.is_active = True
        self.user1.save()
        self.user1.refresh_from_db()
        self.assertTrue(self.user1.is_active)

        # Second deprovisioning request from IdP
        response = self.client.delete(
            f'{self.url}/{self.user1.id}', HTTP_ACCEPT='application/scim+json'
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        self.user1.refresh_from_db()
        self.assertFalse(self.user1.is_active)

    def test_reactivation_only_enables_sso_linked_accounts(self):
        """
        Verify that when a user is reactivated via SCIM, only the accounts linked to
        an SSO provider are reactivated. Password-auth accounts with the same email
        remain disabled.
        """
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        # Setup: james01 (SSO linked), james02 (password auth), james03 (password auth)
        james01 = User.objects.create_user(
            username='james01', email='james@test.org', is_active=True
        )
        SocialAccount.objects.create(
            user=james01, provider=self.social_app.provider_id, uid='james-sso-uid'
        )

        james02 = User.objects.create_user(
            username='james02', email='james@test.org', is_active=True
        )
        james03 = User.objects.create_user(
            username='james03', email='james@test.org', is_active=True
        )
        james04 = User.objects.create_user(
            username='james04', email='james@test.org', is_active=True
        )
        SocialAccount.objects.create(
            user=james04, provider='other-provider-id', uid='james-other-uid'
        )

        # Should deactivate all 3
        response = self.client.delete(
            f'{self.url}/{james01.id}', HTTP_ACCEPT='application/scim+json'
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        james01.refresh_from_db()
        james02.refresh_from_db()
        james03.refresh_from_db()
        james04.refresh_from_db()
        self.assertFalse(james01.is_active)
        self.assertFalse(james02.is_active)
        self.assertFalse(james03.is_active)
        self.assertFalse(james04.is_active)

        # Reactivate via PATCH
        payload = {
            'schemas': [SCIM_SCHEMA_PATCH_OP],
            'Operations': [{'op': 'replace', 'path': 'active', 'value': True}],
        }
        response = self.client.patch(
            f'{self.url}/{james01.id}',
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        james01.refresh_from_db()
        james02.refresh_from_db()
        james03.refresh_from_db()
        james04.refresh_from_db()

        self.assertTrue(james01.is_active)
        self.assertFalse(james02.is_active)
        self.assertFalse(james03.is_active)
        self.assertFalse(james04.is_active)

    def test_reprovisioning_reactivates_sso_linked_accounts_only(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        james01 = User.objects.create_user(
            username='james01', email='james@test.org', is_active=False
        )
        SocialAccount.objects.create(
            user=james01, provider=self.social_app.provider_id, uid='james-sso-uid-post'
        )

        james02 = User.objects.create_user(
            username='james02', email='james@test.org', is_active=False
        )
        james03 = User.objects.create_user(
            username='james03', email='james@test.org', is_active=False
        )
        james04 = User.objects.create_user(
            username='james04', email='james@test.org', is_active=False
        )
        SocialAccount.objects.create(
            user=james04, provider='other-provider-post', uid='james-other-uid-post'
        )

        # Reprovision via POST
        payload = {
            'schemas': [SCIM_SCHEMA_USER],
            'userName': 'james01',
            'emails': [{'primary': True, 'value': 'james@test.org'}],
            'active': True,
            'externalId': 'james-sso-uid-post',
        }
        response = self.client.post(
            self.url,
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        james01.refresh_from_db()
        james02.refresh_from_db()
        james03.refresh_from_db()
        james04.refresh_from_db()

        self.assertTrue(james01.is_active)
        self.assertFalse(james02.is_active)
        self.assertFalse(james03.is_active)
        self.assertFalse(james04.is_active)

    @override_config(
        USER_METADATA_FIELDS=[
            {
                'name': 'country',
                'required': False,
                'scim_mapping': f'{SCIM_SCHEMA_EXTENSION_USER}.country',
                'scim_value_mapping': {'United States': 'US'},
            },
            {
                'name': 'bio',
                'required': False,
                'scim_mapping': f'{SCIM_SCHEMA_EXTENSION_USER}.bio',
            },
            {
                'name': 'organization',
                'required': False,
                'scim_mapping': 'org',
            },
        ]
    )
    def test_custom_metadata_mapping(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        payload = {
            'schemas': [SCIM_SCHEMA_USER],
            'userName': 'metadata_user',
            'emails': [{'primary': True, 'value': 'meta@example.com'}],
            'active': True,
            'org': 'Acme Corp',
            SCIM_SCHEMA_EXTENSION_USER: {
                'country': 'United States',
                'bio': 'Test bio',
            },
        }

        response = self.client.post(
            self.url,
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(username='metadata_user')

        # Check ExtraUserDetail
        extra, _ = ExtraUserDetail.objects.get_or_create(user=user)
        self.assertEqual(extra.data.get('country'), 'US')
        self.assertEqual(extra.data.get('bio'), 'Test bio')
        self.assertEqual(extra.data.get('organization'), 'Acme Corp')

    @override_config(
        USER_METADATA_FIELDS=[
            {
                'name': 'country',
                'required': False,
                'scim_mapping': f'{SCIM_SCHEMA_EXTENSION_USER}.country',
            }
        ]
    )
    def test_patch_metadata_mapping(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        # We test both styles of PATCH (path vs value)
        payload = {
            'schemas': [SCIM_SCHEMA_PATCH_OP],
            'Operations': [
                {
                    'op': 'replace',
                    'path': f'{SCIM_SCHEMA_EXTENSION_USER}.country',
                    'value': 'CA',
                }
            ],
        }
        response = self.client.patch(
            f'{self.url}/{self.user1.id}',
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        extra, _ = ExtraUserDetail.objects.get_or_create(user=self.user1)
        self.assertEqual(extra.data.get('country'), 'CA')

        # Test value-based update
        payload2 = {
            'schemas': [SCIM_SCHEMA_PATCH_OP],
            'Operations': [
                {
                    'op': 'replace',
                    'value': {SCIM_SCHEMA_EXTENSION_USER: {'country': 'GB'}},
                }
            ],
        }
        response = self.client.patch(
            f'{self.url}/{self.user1.id}',
            payload2,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        extra.refresh_from_db()
        self.assertEqual(extra.data.get('country'), 'GB')

    @override_config(
        USER_METADATA_FIELDS=[
            {
                'name': 'country',
                'required': False,
                'scim_mapping': f'{SCIM_SCHEMA_EXTENSION_USER}.country',
            }
        ]
    )
    def test_patch_add_operation(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        payload = {
            'schemas': [SCIM_SCHEMA_PATCH_OP],
            'Operations': [
                {
                    'op': 'add',
                    'path': f'{SCIM_SCHEMA_EXTENSION_USER}.country',
                    'value': 'CA',
                }
            ],
        }
        response = self.client.patch(
            f'{self.url}/{self.user1.id}',
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        extra, _ = ExtraUserDetail.objects.get_or_create(user=self.user1)
        self.assertEqual(extra.data.get('country'), 'CA')

    def test_reactivation_of_user_without_email_works(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        no_email_user = User.objects.create_user(
            username='noemailuser', email='', is_active=False
        )
        SocialAccount.objects.create(
            user=no_email_user, provider=self.social_app.provider_id, uid='no-email-uid'
        )

        # Reactivate via PATCH
        payload = {
            'schemas': [SCIM_SCHEMA_PATCH_OP],
            'Operations': [{'op': 'replace', 'path': 'active', 'value': True}],
        }
        response = self.client.patch(
            f'{self.url}/{no_email_user.id}',
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        no_email_user.refresh_from_db()
        self.assertTrue(no_email_user.is_active)

    @override_config(
        USER_METADATA_FIELDS=[
            {
                'name': 'country',
                'required': False,
                'scim_mapping': f'{SCIM_SCHEMA_EXTENSION_USER}.country',
            }
        ]
    )
    def test_custom_metadata_mapping_validation_failure(self):
        # We removed strict validation against UserProfile, so we now assert
        # that invalid fields like 3-letter country codes are accepted and
        # stored directly in ExtraUserDetail.data without returning 400.
        self.idp.enforce_strict_metadata_validation = True
        self.idp.save()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        payload = {
            'schemas': [SCIM_SCHEMA_USER],
            'userName': 'bad_country_user',
            'emails': [{'primary': True, 'value': 'bad_country@example.com'}],
            'active': True,
            SCIM_SCHEMA_EXTENSION_USER: {
                'country': 'USA',
            },
        }

        response = self.client.post(
            self.url,
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(username='bad_country_user')
        extra_user_detail, _ = ExtraUserDetail.objects.get_or_create(user=user)
        self.assertEqual(extra_user_detail.data.get('country'), 'USA')

    @override_config(
        USER_METADATA_FIELDS=[
            {
                'name': 'country',
                'required': False,
                'scim_mapping': f'{SCIM_SCHEMA_EXTENSION_USER}.country',
            },
            {
                'name': 'organization',
                'required': False,
                'scim_mapping': f'{SCIM_SCHEMA_EXTENSION_USER}.organization',
            },
        ]
    )
    def test_custom_metadata_mapping_validation_ignored_when_disabled(self):
        # By default enforce_strict_metadata_validation is False
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        payload = {
            'schemas': [SCIM_SCHEMA_USER],
            'userName': 'partial_sync_user',
            'emails': [{'primary': True, 'value': 'partial_sync@example.com'}],
            'active': True,
            SCIM_SCHEMA_EXTENSION_USER: {
                'country': 'USA',
                'organization': 'Valid Org',  # Valid
            },
        }

        response = self.client.post(
            self.url,
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(username='partial_sync_user')
        extra_user_detail, _ = ExtraUserDetail.objects.get_or_create(user=user)

        self.assertEqual(extra_user_detail.data.get('country'), 'USA')
        self.assertEqual(extra_user_detail.data.get('organization'), 'Valid Org')

    @override_config(
        USER_METADATA_FIELDS=[
            {
                'name': 'country',
                'required': False,
                'scim_mapping': f'{SCIM_SCHEMA_EXTENSION_USER}.country',
            }
        ]
    )
    def test_custom_metadata_validation_retaining_existing_valid_value(
        self,
    ):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        # Step 1: Create user with valid country
        payload1 = {
            'schemas': [SCIM_SCHEMA_USER],
            'userName': 'existing_metadata_user',
            'emails': [{'primary': True, 'value': 'existing_metadata@example.com'}],
            'active': True,
            SCIM_SCHEMA_EXTENSION_USER: {
                'country': 'US',
            },
        }
        response1 = self.client.post(
            self.url,
            payload1,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)

        user_id = response1.json()['id']

        # Step 2: Patch user with "invalid" country
        payload2 = {
            'schemas': [SCIM_SCHEMA_PATCH_OP],
            'Operations': [
                {
                    'op': 'replace',
                    'value': {SCIM_SCHEMA_EXTENSION_USER: {'country': 'USA'}},
                }
            ],
        }
        response2 = self.client.patch(
            f'{self.url}/{user_id}',
            payload2,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response2.status_code, status.HTTP_200_OK)

        user = User.objects.get(username='existing_metadata_user')

        # ExtraUserDetail metadata should now have USA
        extra_user_detail, _ = ExtraUserDetail.objects.get_or_create(user=user)
        self.assertEqual(extra_user_detail.data.get('country'), 'USA')
