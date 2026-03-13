from allauth.socialaccount.models import SocialAccount, SocialApp
from rest_framework import status
from rest_framework.test import APITestCase

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.kobo_scim.models import IdentityProvider, ScimGroup


class ScimGroupsAPITests(APITestCase):

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

        self.groups_url = f'/api/scim/v2/{self.idp.slug}/Groups'
        self.config_url = f'/api/scim/v2/{self.idp.slug}/ServiceProviderConfig'

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
        # user3 will deliberately NOT be linked to the IdP
        self.user3 = User.objects.create_user(
            username='external',
            email='external@example.com',
            first_name='External',
            last_name='User',
            password='password123',
        )

        # Link the users to the IdP's social app provider
        SocialAccount.objects.create(
            user=self.user1, provider=self.social_app.provider_id, uid='jdoe-uid'
        )
        SocialAccount.objects.create(
            user=self.user2, provider=self.social_app.provider_id, uid='asmith-uid'
        )

    def test_service_provider_config(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        response = self.client.get(self.config_url, HTTP_ACCEPT='application/scim+json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertIn(
            'urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig',
            data['schemas'],
        )
        self.assertTrue(data['patch']['supported'])
        self.assertTrue(data['filter']['supported'])
        self.assertFalse(data['bulk']['supported'])

    def test_service_provider_config_unauthorized(self):
        response = self.client.get(self.config_url, HTTP_ACCEPT='application/scim+json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_group(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        payload = {
            'schemas': ['urn:ietf:params:scim:schemas:core:2.0:Group'],
            'displayName': 'Engineers',
            'externalId': 'sys-eng-group-id',
            'members': [
                {'value': str(self.user1.id), 'display': self.user1.username},
                {
                    'value': str(self.user3.id),
                    'display': self.user3.username,
                },  # Should be ignored
            ],
        }

        response = self.client.post(
            self.groups_url,
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(
            response.status_code, status.HTTP_201_CREATED, response.content
        )

        data = response.json()
        self.assertEqual(data['displayName'], 'Engineers')
        self.assertEqual(data['externalId'], 'sys-eng-group-id')
        # user3 is silently ignored
        self.assertEqual(len(data['members']), 1)
        self.assertEqual(data['members'][0]['value'], self.user1.id)

        # Verify in DB
        group = ScimGroup.objects.get(id=data['id'])
        self.assertEqual(group.name, 'Engineers')
        self.assertEqual(group.scim_external_id, 'sys-eng-group-id')
        self.assertEqual(group.idp, self.idp)
        self.assertEqual(group.members.count(), 1)
        self.assertIn(self.user1, group.members.all())
        self.assertNotIn(self.user3, group.members.all())

    def test_list_groups(self):
        ScimGroup.objects.create(idp=self.idp, name='Group 1')
        ScimGroup.objects.create(idp=self.idp, name='Group 2')

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        response = self.client.get(self.groups_url, HTTP_ACCEPT='application/scim+json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['totalResults'], 2)

        group_names = [g['displayName'] for g in data['Resources']]
        self.assertIn('Group 1', group_names)
        self.assertIn('Group 2', group_names)

    def test_list_groups_filter_by_display_name(self):
        ScimGroup.objects.create(idp=self.idp, name='Group 1')
        ScimGroup.objects.create(idp=self.idp, name='Group 2')

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        response = self.client.get(
            f'{self.groups_url}?filter=displayName eq "Group 2"',
            HTTP_ACCEPT='application/scim+json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['totalResults'], 1)
        self.assertEqual(data['Resources'][0]['displayName'], 'Group 2')

    def test_get_group_by_id(self):
        group = ScimGroup.objects.create(idp=self.idp, name='Test Group')
        group.members.add(self.user1, self.user2)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        response = self.client.get(
            f'{self.groups_url}/{group.id}', HTTP_ACCEPT='application/scim+json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['displayName'], 'Test Group')
        self.assertEqual(len(data['members']), 2)

    def test_put_update_group(self):
        group = ScimGroup.objects.create(
            idp=self.idp, name='Old Name', scim_external_id='old-id'
        )
        group.members.add(self.user1)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        payload = {
            'schemas': ['urn:ietf:params:scim:schemas:core:2.0:Group'],
            'displayName': 'New Name',
            'externalId': 'new-id',
            'members': [{'value': str(self.user2.id)}],  # Replacing user1 with user2
        }

        response = self.client.put(
            f'{self.groups_url}/{group.id}',
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)

        group.refresh_from_db()
        self.assertEqual(group.name, 'New Name')
        self.assertEqual(group.scim_external_id, 'new-id')
        self.assertEqual(group.members.count(), 1)
        self.assertIn(self.user2, group.members.all())
        self.assertNotIn(self.user1, group.members.all())

    def test_patch_add_member(self):
        group = ScimGroup.objects.create(idp=self.idp, name='Test Group')
        group.members.add(self.user1)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        payload = {
            'schemas': ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
            'Operations': [
                {
                    'op': 'add',
                    'path': 'members',
                    'value': [{'value': str(self.user2.id)}],
                }
            ],
        }

        response = self.client.patch(
            f'{self.groups_url}/{group.id}',
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        group.refresh_from_db()
        self.assertEqual(group.members.count(), 2)
        self.assertIn(self.user1, group.members.all())
        self.assertIn(self.user2, group.members.all())

    def test_patch_add_cross_tenant_member_ignored(self):
        """
        Tests that attempting to add a user who is not linked to the IdP's
        SocialApp provider is silently ignored to enforce tenant isolation.
        """
        group = ScimGroup.objects.create(idp=self.idp, name='Test Group')
        group.members.add(self.user1)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        payload = {
            'schemas': ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
            'Operations': [
                {
                    'op': 'add',
                    'path': 'members',
                    'value': [{'value': str(self.user3.id)}],
                }
            ],
        }

        response = self.client.patch(
            f'{self.groups_url}/{group.id}',
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        group.refresh_from_db()
        # user3 should not be in the group since they are not linked to the IdP
        self.assertEqual(group.members.count(), 1)
        self.assertIn(self.user1, group.members.all())
        self.assertNotIn(self.user3, group.members.all())

    def test_patch_remove_member(self):
        group = ScimGroup.objects.create(idp=self.idp, name='Test Group')
        group.members.add(self.user1, self.user2)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        payload = {
            'schemas': ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
            'Operations': [
                {
                    'op': 'remove',
                    'path': 'members',
                    'value': [{'value': str(self.user1.id)}],
                }
            ],
        }

        response = self.client.patch(
            f'{self.groups_url}/{group.id}',
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        group.refresh_from_db()
        self.assertEqual(group.members.count(), 1)
        self.assertIn(self.user2, group.members.all())
        self.assertNotIn(self.user1, group.members.all())

    def test_patch_remove_member_with_filter_path(self):
        group = ScimGroup.objects.create(idp=self.idp, name='Test Group')
        group.members.add(self.user1, self.user2)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')

        payload = {
            'schemas': ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
            'Operations': [
                {'op': 'remove', 'path': f'members[value eq "{self.user2.id}"]'}
            ],
        }

        response = self.client.patch(
            f'{self.groups_url}/{group.id}',
            payload,
            format='json',
            HTTP_ACCEPT='application/scim+json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        group.refresh_from_db()
        self.assertEqual(group.members.count(), 1)
        self.assertIn(self.user1, group.members.all())
        self.assertNotIn(self.user2, group.members.all())

    def test_delete_group(self):
        group = ScimGroup.objects.create(idp=self.idp, name='To Delete')

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        response = self.client.delete(
            f'{self.groups_url}/{group.id}', HTTP_ACCEPT='application/scim+json'
        )

        self.assertEqual(
            response.status_code, status.HTTP_204_NO_CONTENT, response.content
        )
        self.assertFalse(ScimGroup.objects.filter(id=group.id).exists())
