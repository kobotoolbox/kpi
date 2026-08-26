import json
from unittest.mock import patch

import responses
from allauth.core.exceptions import ImmediateHttpResponse
from allauth.socialaccount.models import SocialAccount, SocialApp, SocialLogin
from allauth.socialaccount.providers.base.constants import AuthProcess
from django.conf import settings
from django.contrib.messages.storage.fallback import FallbackStorage
from django.contrib.sessions.middleware import SessionMiddleware
from django.test import RequestFactory, TestCase
from django.test.utils import override_settings
from django.urls import reverse
from model_bakery import baker
from rest_framework import status
from rest_framework.test import APITestCase

from kobo.apps.accounts.adapter import SocialAccountAdapter
from kobo.apps.openrosa.apps.main.models import UserProfile
from kpi.utils.fuzzy_int import FuzzyInt
from .constants import SOCIALACCOUNT_PROVIDERS


class AccountsEmailTestCase(APITestCase):
    def setUp(self):
        self.user = baker.make(settings.AUTH_USER_MODEL)
        self.client.force_login(self.user)
        self.url_list = reverse('socialaccount-list')

    def test_list(self):
        account1 = baker.make('socialaccount.SocialAccount', user=self.user)
        account2 = baker.make('socialaccount.SocialAccount')
        # Auth, Count, Queryset
        with self.assertNumQueries(FuzzyInt(3, 5)):
            res = self.client.get(self.url_list)
        self.assertContains(res, account1.uid)
        self.assertNotContains(res, account2.uid)

    def test_delete(self):
        account = baker.make('socialaccount.SocialAccount', user=self.user)
        url = reverse(
            'socialaccount-detail',
            kwargs={'provider': account.provider, 'uid_social_account': account.uid},
        )
        res = self.client.delete(url)
        self.assertEqual(res.status_code, 204)
        self.assertFalse(self.user.socialaccount_set.exists())


class SingleSocialAccountTestCase(TestCase):
    """Guard that limits users to one linked SSO account."""

    def setUp(self):
        self.user = baker.make(settings.AUTH_USER_MODEL)
        self.adapter = SocialAccountAdapter()

    def _build_request(self):
        request = RequestFactory().get('/')
        request.user = self.user
        # Rendering the error page runs the context processors, which need a
        # session and a message store
        SessionMiddleware(lambda r: None).process_request(request)
        request._messages = FallbackStorage(request)
        return request

    def _build_connect_login(self, provider='microsoft', uid='new-uid'):
        new_account = SocialAccount(provider=provider, uid=uid)
        sociallogin = SocialLogin(user=self.user, account=new_account)
        sociallogin.state['process'] = AuthProcess.CONNECT
        return sociallogin

    def test_blocks_linking_second_account(self):
        baker.make(
            'socialaccount.SocialAccount',
            user=self.user,
            provider='openid_connect',
            uid='existing-uid',
        )
        request = self._build_request()
        sociallogin = self._build_connect_login(provider='microsoft', uid='new-uid')

        with self.assertRaises(ImmediateHttpResponse) as cm:
            self.adapter.pre_social_login(request, sociallogin)

        # The user is told why, rather than being bounced silently
        response = cm.exception.response
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn(
            'You can only link one SSO account at a time',
            response.content.decode(),
        )
        # No second account was created
        self.assertEqual(SocialAccount.objects.filter(user=self.user).count(), 1)

    def test_allows_linking_first_account(self):
        request = self._build_request()
        sociallogin = self._build_connect_login()

        # No existing account: the guard must not interfere
        self.assertIsNone(self.adapter.pre_social_login(request, sociallogin))

    def test_allows_reconnecting_same_account(self):
        baker.make(
            'socialaccount.SocialAccount',
            user=self.user,
            provider='microsoft',
            uid='same-uid',
        )
        request = self._build_request()
        # Reconnecting the same account is not a second link.
        sociallogin = self._build_connect_login(provider='microsoft', uid='same-uid')

        self.assertIsNone(self.adapter.pre_social_login(request, sociallogin))

    def test_ignores_non_connect_process(self):
        baker.make('socialaccount.SocialAccount', user=self.user)
        request = self._build_request()
        sociallogin = self._build_connect_login()
        # A plain SSO login (not a connect) must never be blocked
        sociallogin.state['process'] = AuthProcess.LOGIN

        self.assertIsNone(self.adapter.pre_social_login(request, sociallogin))


@override_settings(SOCIALACCOUNT_PROVIDERS=SOCIALACCOUNT_PROVIDERS)
class SingleSocialAccountConnectFlowTestCase(TestCase):
    """
    This test exercises the same guard through the real OAuth2 callback
    URL, instead of calling the adapter directly. This is the path that was
    actually exploitable in production: hidden SSO providers keep a working
    `/accounts/oidc/<provider_id>/login/?process=connect` URL even when no
    button is rendered for them, so a restriction enforced only on the
    frontend was trivial to bypass by visiting the URL directly
    """

    def setUp(self):
        self.user = baker.make(settings.AUTH_USER_MODEL)
        UserProfile.objects.create(user=self.user)
        self.client.force_login(self.user)
        SocialApp.objects.all().delete()
        self.callback_url = reverse('openid_connect_callback', args=('openid_connect',))

    def _mock_provider_endpoints(self):
        """
        Mock `requests` responses to fool django-allauth
        """
        responses.add(
            responses.GET,
            'http://testserver/oauth/.well-known/openid-configuration',
            status=status.HTTP_200_OK,
            content_type='application/json',
            body=json.dumps(
                {
                    'token_endpoint': 'http://testserver/oauth/token',
                    'authorization_endpoint': 'http://testserver/oauth/authorize',
                    'userinfo_endpoint': 'http://testserver/oauth/userinfo',
                }
            ),
        )
        responses.add(
            responses.POST,
            'http://testserver/oauth/token',
            status=status.HTTP_200_OK,
            content_type='application/json',
            body=json.dumps(
                {
                    'access_token': 'mock_access_token',
                    'refresh_token': 'mock_refresh_token',
                }
            ),
        )
        responses.add(
            responses.GET,
            'http://testserver/oauth/userinfo',
            status=status.HTTP_200_OK,
            content_type='application/json',
            body=json.dumps(
                {
                    'sub': 'incoming-uid',
                    'preferred_username': 'incoming',
                    'email': 'incoming@testserver',
                }
            ),
        )

    def _simulate_connect_callback(self):
        self._mock_provider_endpoints()
        # Simulate the SSO provider redirecting the user back to kpi
        return self.client.get(
            self.callback_url, data={'code': 'foobar', 'state': '12345'}
        )

    @responses.activate
    @patch('allauth.socialaccount.providers.oauth2.views.statekit.unstash_state')
    def test_connect_is_blocked_when_another_account_is_linked(
        self, mock_unstash_state
    ):
        mock_unstash_state.return_value = {'process': 'connect'}
        already_linked = baker.make(
            'socialaccount.SocialAccount',
            user=self.user,
            provider='another-app',
            uid='another-uid',
        )

        response = self._simulate_connect_callback()

        self.assertContains(
            response,
            'You can only link one SSO account at a time',
            status_code=status.HTTP_401_UNAUTHORIZED,
        )
        # The second account was never created, and the first is untouched
        accounts = SocialAccount.objects.filter(user=self.user)
        self.assertEqual(accounts.count(), 1)
        self.assertEqual(accounts.first().pk, already_linked.pk)

    @responses.activate
    @patch('allauth.socialaccount.providers.oauth2.views.statekit.unstash_state')
    def test_connect_succeeds_when_no_account_is_linked(self, mock_unstash_state):
        mock_unstash_state.return_value = {'process': 'connect'}

        response = self._simulate_connect_callback()

        # The guard must not get in the way of the legitimate first link
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        account = SocialAccount.objects.get(user=self.user)
        self.assertEqual(account.provider, 'test-app')
        self.assertEqual(account.uid, 'incoming-uid')
