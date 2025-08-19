# coding: utf-8
from django.test import override_settings
from django.test.client import Client
from django.urls import reverse
from rest_framework import status

from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from trench.utils import get_mfa_model


class TestAuthBase(TestBase):

    def setUp(self):
        TestBase.setUp(self)
        self._create_user_and_login(username='bob', password='bob')
        self._publish_transportation_form()
        self.api_url = reverse('data-list', kwargs={
            'pk': self.xform.pk,
            'format': 'json'
        })
        self._logout()

    @staticmethod
    def activate_mfa(user: 'kobo_auth.User'):
        get_mfa_model().objects.create(
            user=user,
            secret='dummy_mfa_secret',
            name='app',
            is_primary=True,
            is_active=True,
            _backup_codes='dummy_encoded_codes',
        )
        user.profile.is_mfa_active = True
        user.profile.save(update_fields=['is_mfa_active'])


class TestBasicHttpAuthentication(TestAuthBase):

    def test_http_auth(self):
        response = self.client.get(self.api_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        # headers with invalid user/pass
        response = self.client.get(self.api_url,
                                   **self._set_auth_headers('x', 'y'))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # headers with valid user/pass
        client = Client()
        response = client.get(
            self.api_url, **self._set_auth_headers('bob', 'bob')
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_http_auth_shared_data(self):
        self.xform.shared_data = True
        self.xform.save()
        response = self.anon.get(self.api_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Log in as bob
        self._login(username='bob', password='bob')
        response = self.client.get(self.api_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_http_auth_failed_with_mfa_active(self):
        # headers with valid user/pass
        response = self.client.get(
            self.api_url, **self._set_auth_headers('bob', 'bob')
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Activate MFA
        self.activate_mfa(self.user)
        response = self.client.get(
            self.api_url, **self._set_auth_headers('bob', 'bob')
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_http_auth_with_mfa_active_with_exception(self):
        # Activate MFA
        self.activate_mfa(self.user)
        response = self.client.get(
            self.api_url, **self._set_auth_headers('bob', 'bob')
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # Allow Basic Auth with MFA
        with override_settings(MFA_SUPPORTED_AUTH_CLASSES=[
            'kobo.apps.openrosa.libs.authentication.HttpsOnlyBasicAuthentication',
        ]):
            response = self.client.get(
                self.api_url, **self._set_auth_headers('bob', 'bob')
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)


class TestDigestAuthentication(TestAuthBase):

    def setUp(self):
        super().setUp()
        # Data endpoint does not support Digest.
        # Let's test it against the XForm list
        self.api_url = reverse('data-list', kwargs={'format': 'json'})

    def test_digest_auth_failed_with_mfa_active(self):
        # headers with valid user/pass
        digest_client = self._get_authenticated_client(
            self.api_url, 'bob', 'bob'
        )
        response = digest_client.get(self.api_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Activate MFA
        self.activate_mfa(self.user)
        digest_client = self._get_authenticated_client(
            self.api_url, 'bob', 'bob'
        )
        response = digest_client.get(self.api_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_digest_auth_with_mfa_active_with_exception(self):
        # Activate MFA
        self.activate_mfa(self.user)
        digest_client = self._get_authenticated_client(
            self.api_url, 'bob', 'bob'
        )
        response = digest_client.get(self.api_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # Allow Basic Auth with MFA
        with override_settings(MFA_SUPPORTED_AUTH_CLASSES=[
            'kpi.authentication.DigestAuthentication',
        ]):
            digest_client = self._get_authenticated_client(
                self.api_url, 'bob', 'bob'
            )
            response = digest_client.get(self.api_url)
            self.assertEqual(response.status_code, status.HTTP_200_OK)


class TestTokenAuthentication(TestAuthBase):

    def _set_auth_headers(self, token):
        return {
            'HTTP_AUTHORIZATION': f'Token {token}'
        }

    # FIXME, the name of the test is wrong. should be test_token_auth_success_with_mfa_active
    def test_token_auth_failed_with_mfa_active(self):
        # headers with valid token
        response = self.client.get(
            self.api_url, **self._set_auth_headers(self.user.auth_token)
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Activate MFA, token auth is allowed with MFA by default
        self.activate_mfa(self.user)
        response = self.client.get(
            self.api_url, **self._set_auth_headers(self.user.auth_token)
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_token_auth_with_mfa_active_with_exception(self):
        # Activate MFA
        self.activate_mfa(self.user)

        # Forbid token auth with MFA (it's allowed by default)
        with override_settings(MFA_SUPPORTED_AUTH_CLASSES=[]):
            response = self.client.get(
                self.api_url, **self._set_auth_headers(self.user.auth_token)
            )
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # Default settings, allow token Auth with MFA
        response = self.client.get(
            self.api_url, **self._set_auth_headers(self.user.auth_token)
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
