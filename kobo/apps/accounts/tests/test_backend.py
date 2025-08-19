import json
from unittest.mock import patch

import responses
from allauth.socialaccount.models import SocialAccount, SocialApp
from django.conf import settings
from django.test import TestCase
from django.test.utils import override_settings
from django.urls import reverse
from rest_framework import status

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AuditLog
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.main.models import UserProfile
from .constants import SOCIALACCOUNT_PROVIDERS


class SSOLoginTest(TestCase):

    def setUp(self):
        # Create a user for the test
        testuser = User.objects.create_user(
            username='testuser',
            email='testuser@testserver',
            password='password',
        )

        # Will be needed when merged in release/2.024.25
        UserProfile.objects.create(user=testuser)

        # Delete any social app that could be added by migration
        # `0007_add_providers_from_environment_to_db`
        SocialApp.objects.all().delete()

        self.extra_data = {
            'username': 'testuser',
            'sub': 'testuser',  # `sub` is required by django allauth
            'preferred_username': 'testuser',
            'email': 'testuser@testserver',
        }

        # Create a social account for user
        self.social_account = SocialAccount.objects.create(
            user=testuser,
            provider='test-app',
            uid='testuser',
            extra_data=self.extra_data,
        )

    @override_settings(SOCIALACCOUNT_PROVIDERS=SOCIALACCOUNT_PROVIDERS)
    @responses.activate
    @patch('allauth.socialaccount.providers.oauth2.views.statekit.unstash_state')
    def test_keep_django_auth_backend_with_sso(self, mock_unstash_state):
        mock_unstash_state.return_value = {'process': 'login'}

        # Mock `requests` responses to fool django-allauth
        responses.add(
            responses.GET,
            'http://testserver/oauth/.well-known/openid-configuration',
            status=status.HTTP_200_OK,
            content_type='application/json',
            body=json.dumps({
                'token_endpoint': 'http://testserver/oauth/token',
                'authorization_endpoint': 'http://testserver/oauth/authorize',
                'userinfo_endpoint': 'http://testserver/oauth/userinfo',
            }),
        )

        responses.add(
            responses.POST,
            'http://testserver/oauth/token',
            status=status.HTTP_200_OK,
            content_type='application/json',
            body=json.dumps({
                'access_token': 'mock_access_token',
                'refresh_token': 'mock_refresh_token'
            }),
        )

        responses.add(
            responses.GET,
            'http://testserver/oauth/userinfo',
            status=status.HTTP_200_OK,
            content_type='application/json',
            body=json.dumps(self.extra_data),
        )

        # Get SSO provider callback URL
        sso_login_url = reverse(
            'openid_connect_callback', args=('openid_connect',)
        )

        # Simulate GET request to SSO provider
        mock_sso_response = {'code': 'foobar', 'state': '12345'}
        response = self.client.get(sso_login_url, data=mock_sso_response)

        # Ensure user is logged in
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertRedirects(response, reverse(settings.LOGIN_REDIRECT_URL))

        self.assertTrue(response.wsgi_request.user.is_authenticated)
        # Ensure there is a record of the login
        audit_log: AuditLog = AuditLog.objects.filter(user=response.wsgi_request.user).first()
        self.assertEqual(audit_log.action, AuditAction.AUTH)
        assert response.wsgi_request.user.backend == settings.AUTHENTICATION_BACKENDS[0]
