from unittest.mock import patch

from allauth.core.exceptions import ImmediateHttpResponse
from allauth.socialaccount.models import SocialAccount, SocialApp, SocialLogin
from allauth.socialaccount.providers.base.constants import AuthProcess
from django.contrib.auth.models import AnonymousUser
from django.contrib.messages.storage.fallback import FallbackStorage
from django.contrib.sessions.middleware import SessionMiddleware
from django.test import RequestFactory, TestCase
from django.test.utils import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from kobo.apps.accounts.adapter import SocialAccountAdapter
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.kobo_scim.models import IdentityProvider


class ScimProvisioningTestCase(TestCase):
    def setUp(self):
        self.adapter = SocialAccountAdapter()
        self.social_app = SocialApp.objects.create(
            provider='openid_connect',
            provider_id='keycloak',
            name='Keycloak SSO',
            client_id='test-client-id',
            secret='test-secret',
        )
        self.idp = IdentityProvider.objects.create(
            name='Keycloak SCIM IdP',
            slug='keycloak-idp',
            scim_api_key='secret-key',
            social_app=self.social_app,
            is_active=True,
        )
        self.provisioning_url = reverse('api_v2:social-account-provisioning')
        self.provisioning_html_url = reverse('socialaccount_provisioning')

    def _build_login(
        self, provider='keycloak', uid='incoming-uid', email='user@example.com'
    ):
        account = SocialAccount(provider=provider, uid=uid)
        user = User(email=email, username='testuser')
        provider_instance = self.adapter.get_provider(None, provider=provider)
        sociallogin = SocialLogin(
            user=user, account=account, provider=provider_instance
        )
        sociallogin.state['process'] = AuthProcess.LOGIN
        return sociallogin

    def _build_request(self):
        request = RequestFactory().get('/')
        request.user = AnonymousUser()
        SessionMiddleware(lambda r: None).process_request(request)
        request._messages = FallbackStorage(request)
        return request

    def test_first_time_login_with_scim_provider_redirects_to_provisioning(self):
        sociallogin = self._build_login()
        request = self._build_request()

        with self.assertRaises(ImmediateHttpResponse) as cm:
            self.adapter.pre_social_login(request, sociallogin)

        response = cm.exception.response
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertEqual(response.url, self.provisioning_html_url)
        self.assertIn('socialaccount_sociallogin', request.session)
        self.assertIn('scim_provisioning_start', request.session)

    def test_first_time_login_with_non_scim_provider_does_not_redirect(self):
        # Inactive IDP
        self.idp.is_active = False
        self.idp.save()

        sociallogin = self._build_login()
        request = self._build_request()

        # Does not raise ImmediateHttpResponse
        result = self.adapter.pre_social_login(request, sociallogin)
        self.assertIsNone(result)

    def test_is_open_for_signup_false_for_scim_provider(self):
        sociallogin = self._build_login()
        request = self._build_request()
        self.assertFalse(self.adapter.is_open_for_signup(request, sociallogin))

    @patch('kobo.apps.accounts.adapter.apps.is_installed', return_value=False)
    def test_is_scim_enabled_false_when_kobo_scim_not_installed(self, mock_is_installed):
        sociallogin = self._build_login()
        request = self._build_request()
        self.assertFalse(self.adapter.is_scim_enabled(request, sociallogin))
        self.assertIsNone(self.adapter.pre_social_login(request, sociallogin))

    def test_provisioning_html_view_renders_template_when_session_present(self):
        sociallogin = self._build_login()
        session = self.client.session
        session['socialaccount_sociallogin'] = sociallogin.serialize()
        session['scim_provisioning_start'] = timezone.now().timestamp()
        session.save()

        response = self.client.get(self.provisioning_html_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTemplateUsed(response, 'socialaccount/provisioning.html')
        self.assertContains(response, 'js/socialaccount_provisioning.js')
        self.assertContains(
            response, f'data-poll-url="{self.provisioning_url}"'
        )

    def test_provisioning_html_view_redirects_to_login_when_no_session(self):
        response = self.client.get(self.provisioning_html_url)
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertIn('/accounts/login/', response.url)

    def test_provisioning_view_without_session_returns_expired(self):
        response = self.client.get(self.provisioning_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json(),
            {'ready': False, 'expired': True, 'redirect_url': None},
        )

    def test_provisioning_view_pending_poll(self):
        sociallogin = self._build_login()
        session = self.client.session
        session['socialaccount_sociallogin'] = sociallogin.serialize()
        session['scim_provisioning_start'] = timezone.now().timestamp()
        session.save()

        response = self.client.get(self.provisioning_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json(),
            {'ready': False, 'expired': False, 'redirect_url': None},
        )

    def test_provisioning_view_ready_poll_completes_login(self):
        sociallogin = self._build_login(uid='cleo-uid', email='cleo@example.com')
        # Simulate SCIM user creation
        cleo = User.objects.create_user(username='cleo', email='cleo@example.com')
        SocialAccount.objects.create(user=cleo, provider='keycloak', uid='cleo-uid')

        session = self.client.session
        session['socialaccount_sociallogin'] = sociallogin.serialize()
        session['scim_provisioning_start'] = timezone.now().timestamp()
        session.save()

        response = self.client.get(self.provisioning_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data['ready'])
        self.assertFalse(data['expired'])
        self.assertEqual(data['redirect_url'], '/')

        # User is logged in to the session
        self.assertEqual(int(self.client.session['_auth_user_id']), cleo.pk)

        # Pending session is cleared
        self.assertNotIn('socialaccount_sociallogin', self.client.session)
        self.assertNotIn('scim_provisioning_start', self.client.session)

    @override_settings(SOCIALACCOUNT_EMAIL_VERIFICATION='mandatory')
    def test_provisioning_w_mandatory_email_verification_goes_to_confirmation(self):
        sociallogin = self._build_login(uid='cleo-uid', email='cleo@example.com')
        # Simulate SCIM user creation (email unconfirmed)
        cleo = User.objects.create_user(username='cleo', email='cleo@example.com')
        SocialAccount.objects.create(user=cleo, provider='keycloak', uid='cleo-uid')

        session = self.client.session
        session['socialaccount_sociallogin'] = sociallogin.serialize()
        session['scim_provisioning_start'] = timezone.now().timestamp()
        session.save()

        response = self.client.get(self.provisioning_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data['ready'])
        self.assertFalse(data['expired'])
        self.assertEqual(
            data['redirect_url'], reverse('account_email_verification_sent')
        )

        # User is not logged in yet due to mandatory email verification
        self.assertNotIn('_auth_user_id', self.client.session)

        # Pending session is cleared
        self.assertNotIn('socialaccount_sociallogin', self.client.session)
        self.assertNotIn('scim_provisioning_start', self.client.session)

    def test_provisioning_view_expired_clears_session(self):
        sociallogin = self._build_login()
        session = self.client.session
        session['socialaccount_sociallogin'] = sociallogin.serialize()
        # Set start time to 70 seconds ago (> 60s timeout)
        session['scim_provisioning_start'] = timezone.now().timestamp() - 70
        session.save()

        response = self.client.get(self.provisioning_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json(),
            {'ready': False, 'expired': True, 'redirect_url': None},
        )

        # Session data was cleared
        self.assertNotIn('socialaccount_sociallogin', self.client.session)
        self.assertNotIn('scim_provisioning_start', self.client.session)
