from allauth.socialaccount.models import SocialApp
from constance.test import override_config
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from kobo.apps.kobo_scim.constants import SCIM_SCHEMA_GROUP, SCIM_SCHEMA_USER
from kobo.apps.kobo_scim.models import IdentityProvider
from kobo.apps.kobo_scim.utils import get_scim_extension_schemas


class ScimSchemasAPITests(APITestCase):
    def setUp(self):
        self.social_app = SocialApp.objects.create(
            provider='openid_connect',
            provider_id='test-provider-id',
            name='Test Provider',
            client_id='test-client-id',
        )
        self.idp = IdentityProvider.objects.create(
            name='Test IdP',
            slug='test-idp',
            scim_api_key='secret-token',
            is_active=True,
            social_app=self.social_app,
        )

    def get_schemas_url(self):
        return reverse(
            'api_v2:kobo_scim:scim-schemas', kwargs={'idp_slug': self.idp.slug}
        )

    def get_resource_types_url(self):
        return reverse(
            'api_v2:kobo_scim:scim-resource-types', kwargs={'idp_slug': self.idp.slug}
        )

    def test_get_scim_extension_schemas_util_empty(self):
        # By default, without USER_METADATA_FIELDS, should return empty list
        self.assertEqual(get_scim_extension_schemas(), [])

    @override_config(
        USER_METADATA_FIELDS=[
            {
                'name': 'organization',
                'scim_mapping': 'urn:ietf:params:scim:schemas:extension:kobo:2.0:User.organization',
            },
            {
                'name': 'country',
                'scim_mapping': 'urn:ietf:params:scim:schemas:extension:kobo:2.0:User.country',
            },
            {
                'name': 'bio',
                'scim_mapping': 'urn:ietf:params:scim:schemas:extension:kobo:2.0:User.bio',
            },
        ]
    )
    def test_get_scim_extension_schemas_util_configured(self):
        schemas = get_scim_extension_schemas()
        self.assertEqual(len(schemas), 1)
        schema = schemas[0]
        self.assertEqual(
            schema['id'], 'urn:ietf:params:scim:schemas:extension:kobo:2.0:User'
        )
        self.assertEqual(len(schema['attributes']), 3)

        attr_names = [attr['name'] for attr in schema['attributes']]
        self.assertIn('organization', attr_names)
        self.assertIn('country', attr_names)
        self.assertIn('bio', attr_names)

    def test_schemas_endpoint_unauthenticated(self):
        response = self.client.get(
            self.get_schemas_url(), HTTP_ACCEPT='application/scim+json'
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_schemas_endpoint_core_only(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        response = self.client.get(
            self.get_schemas_url(), HTTP_ACCEPT='application/scim+json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertEqual(data['totalResults'], 2)
        schema_ids = [res['id'] for res in data['Resources']]
        self.assertIn(SCIM_SCHEMA_USER, schema_ids)
        self.assertIn(SCIM_SCHEMA_GROUP, schema_ids)

    @override_config(
        USER_METADATA_FIELDS=[
            {
                'name': 'organization',
                'scim_mapping': 'urn:ietf:params:scim:schemas:extension:kobo:2.0:User.organization',
            }
        ]
    )
    def test_schemas_endpoint_with_extensions(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        response = self.client.get(
            self.get_schemas_url(), HTTP_ACCEPT='application/scim+json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertEqual(data['totalResults'], 3)
        schema_ids = [res['id'] for res in data['Resources']]
        self.assertIn(SCIM_SCHEMA_USER, schema_ids)
        self.assertIn(SCIM_SCHEMA_GROUP, schema_ids)
        self.assertIn(
            'urn:ietf:params:scim:schemas:extension:kobo:2.0:User', schema_ids
        )

    @override_config(
        USER_METADATA_FIELDS=[
            {
                'name': 'organization',
                'scim_mapping': 'urn:ietf:params:scim:schemas:extension:kobo:2.0:User.organization',
            }
        ]
    )
    def test_resource_types_endpoint_with_extensions(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.idp.scim_api_key}')
        response = self.client.get(
            self.get_resource_types_url(), HTTP_ACCEPT='application/scim+json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        user_resource = next(res for res in data['Resources'] if res['id'] == 'User')

        # User resource should have the extension appended
        self.assertEqual(len(user_resource['schemaExtensions']), 1)
        self.assertEqual(
            user_resource['schemaExtensions'][0]['schema'],
            'urn:ietf:params:scim:schemas:extension:kobo:2.0:User',
        )
