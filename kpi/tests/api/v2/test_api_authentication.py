# coding: utf-8
import base64

from django.contrib.auth.models import User
from django.urls import reverse
from django.test import override_settings
from rest_framework import status

from rest_framework.authtoken.models import Token
from kpi.tests.base_test_case import BaseAssetTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE
from trench.utils import get_mfa_model


class AuthenticationApiTests(BaseAssetTestCase):
    fixtures = ['test_data']

    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        self.anotheruser = User.objects.get(username='anotheruser')
        self.list_url = reverse(self._get_endpoint('asset-list'))

        # Activate MFA for someuser
        get_mfa_model().objects.create(
            user=self.someuser,
            secret='dummy_mfa_secret',
            name='app',
            is_primary=True,
            is_active=True,
            _backup_codes='dummy_encoded_codes',
        )

        # Ensure `self.client` is not authenticated
        self.client.logout()

    def test_token_authentication_with_mfa_enabled(self):
        token, _ = Token.objects.get_or_create(user=self.someuser)
        auth_headers = {
            'HTTP_AUTHORIZATION': f'Token {token.key}',
        }

        # Forbid token auth with MFA (it's allowed by default)
        with override_settings(MFA_SUPPORTED_AUTH_CLASSES=[]):
            response = self.client.get(self.list_url, **auth_headers)

        # DRF looks at the first authentication class to expose
        # a `WWW-authenticate` header. If the first one does not implement a
        # `authenticate_header()` method, it coerces exceptions to 403
        # Because SessionAuthentication is the first one, a 403 is returned.
        # If it had been BasicAuthentication, it would have been a 401 response
        # instead.
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(
            'Multi-factor authentication is enabled for this account.'
            in response.content.decode()
        )

    def test_token_authentication_with_mfa_disabled(self):
        token, _ = Token.objects.get_or_create(user=self.anotheruser)
        auth_headers = {
            'HTTP_AUTHORIZATION': f'Token {token.key}'
        }
        response = self.client.get(self.list_url, **auth_headers)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            'Multi-factor authentication is enabled for this account.'
            in response.content.decode()
        )

    def test_basic_authentication_with_mfa_enabled(self):
        base64_encoded_credentials = base64.b64encode(
            b'someuser:someuser'
        ).decode('ascii')
        auth_headers = {
            'HTTP_AUTHORIZATION': f'Basic {base64_encoded_credentials}'
        }

        response = self.client.get(self.list_url, **auth_headers)
        # DRF looks at the first authentication class to expose
        # a `WWW-authenticate` header. If the first one does not implement a
        # `authenticate_header()` method, it coerces exceptions to 403
        # Because SessionAuthentication is the first one, a 403 is returned.
        # If it had been BasicAuthentication, it would have been a 401 response
        # instead.
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(
            'Multi-factor authentication is enabled for this account.'
            in response.content.decode()
        )

    def test_basic_authentication_with_mfa_disabled(self):
        base64_encoded_credentials = base64.b64encode(
            b'anotheruser:anotheruser'
        ).decode('ascii')
        auth_headers = {
            'HTTP_AUTHORIZATION': f'Basic {base64_encoded_credentials}'
        }
        response = self.client.get(self.list_url, **auth_headers)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(
            'Multi-factor authentication is enabled for this account.'
            in response.content.decode()
        )
