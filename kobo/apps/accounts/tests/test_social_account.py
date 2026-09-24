import json
from datetime import timedelta
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import responses
from allauth.account.internal.flows.login import AUTHENTICATION_METHODS_SESSION_KEY
from allauth.core.exceptions import ImmediateHttpResponse
from allauth.socialaccount.models import SocialAccount, SocialApp, SocialLogin
from allauth.socialaccount.providers.base.constants import AuthProcess
from ddt import data, ddt
from django.conf import settings
from django.contrib.messages.storage.fallback import FallbackStorage
from django.contrib.sessions.middleware import SessionMiddleware
from django.shortcuts import resolve_url
from django.test import RequestFactory, TestCase
from django.test.utils import override_settings
from django.urls import reverse
from django.utils import timezone
from model_bakery import baker
from rest_framework import status
from rest_framework.test import APITestCase

from kobo.apps.accounts.adapter import AccountAdapter, SocialAccountAdapter
from kobo.apps.openrosa.apps.main.models import UserProfile
from kpi.utils.fuzzy_int import FuzzyInt
from ...help.models import InAppMessage, InAppMessageUsers, MessageType
from ...kobo_auth.shortcuts import User
from ..models import SocialAppCustomData, SocialAppManagedDomain
from ..utils import SOCIAL_APP_IDENTIFIER
from .constants import APP_PROVIDER_ID


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


@ddt
@override_settings(SOCIALACCOUNT_PROVIDERS={})
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
        self.user = baker.make(
            settings.AUTH_USER_MODEL,
            email='incoming@testserver',
            password='password',
        )
        UserProfile.objects.create(user=self.user)
        self.client.force_login(self.user)
        self.callback_url = reverse('openid_connect_callback', args=('openid_connect',))
        self.social_app = SocialApp.objects.create(
            client_id='test.service.id',
            secret='test.service.secret',
            name='Test App',
            provider='openid_connect',
            provider_id=APP_PROVIDER_ID,
            settings={
                'server_url': 'http://testserver/oauth/.well-known/openid-configuration'
            },
        )
        patcher = patch(
            'allauth.socialaccount.providers.oauth2.views.statekit.unstash_state',
            return_value={'process': 'connect'},
        )
        patcher.start()
        self.addCleanup(patcher.stop)

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
    def test_connect_is_blocked_when_another_account_is_linked(self):
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
    def test_connect_succeeds_when_no_account_is_linked(self):

        response = self._simulate_connect_callback()

        # The guard must not get in the way of the legitimate first link
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        account = SocialAccount.objects.get(user=self.user)
        self.assertEqual(account.provider, APP_PROVIDER_ID)
        self.assertEqual(account.uid, 'incoming-uid')

    @responses.activate
    def test_connecting_managed_account_sets_unusable_password(self):
        assert self.user.has_usable_password()

        custom_data = SocialAppCustomData.objects.create(
            social_app=self.social_app, managed=True
        )
        SocialAppManagedDomain.objects.create(
            social_app=custom_data, domain='testserver'
        )
        self._simulate_connect_callback()
        self.user.refresh_from_db()
        assert not self.user.has_usable_password()

    @responses.activate
    @data(True, False)
    def test_connecting_managed_account_removes_inapp_message_for_user(
        self, multiple_users
    ):
        i = InAppMessage.objects.create(
            title='title',
            snippet='snippet',
            body='body',
            published=True,
            valid_from=timezone.now(),
            valid_until=timezone.now() + timedelta(days=365),
            always_display_as_new=True,
            generic_related_objects={SOCIAL_APP_IDENTIFIER: self.social_app.pk},
            message_type=MessageType.MANAGED_SSO_REMINDER,
        )
        InAppMessageUsers.objects.create(in_app_message=i, user=self.user)
        if multiple_users:
            second_user = User.objects.create_user(username='second')
            InAppMessageUsers.objects.create(in_app_message=i, user=second_user)

        custom_data = SocialAppCustomData.objects.create(
            social_app=self.social_app, managed=True
        )
        SocialAppManagedDomain.objects.create(
            social_app=custom_data, domain='testserver'
        )
        self._simulate_connect_callback()
        self.user.refresh_from_db()
        assert not InAppMessageUsers.objects.filter(
            user=self.user, in_app_message=i
        ).exists()
        now = timezone.now()
        i.refresh_from_db()
        if multiple_users:
            assert InAppMessageUsers.objects.filter(
                user=second_user, in_app_message=i
            ).exists()
            # message should not have been expired
            assert i.valid_until > now
        else:
            # if there was only one user still getting the message, it should be expired
            assert i.valid_until < now


class SocialAccountLogoutTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='sso_user', email='sso@example.com'
        )
        self.factory = RequestFactory()
        self.adapter = AccountAdapter()
        self.social_app = SocialApp.objects.create(
            provider='openid_connect',
            provider_id='keycloak',
            name='Keycloak SSO',
            client_id='kpi-client-id',
            secret='kpi-secret',
        )

    def _get_authenticated_request(self, user=None):
        request = self.factory.post('/accounts/logout/')
        request.user = user or self.user
        middleware = SessionMiddleware(lambda req: None)
        middleware.process_request(request)
        request.session.save()
        return request

    def test_anonymous_user_returns_default_logout_url(self):
        request = self.factory.post('/accounts/logout/')
        from django.contrib.auth.models import AnonymousUser

        request.user = AnonymousUser()
        url = self.adapter.get_logout_redirect_url(request)
        self.assertEqual(url, resolve_url(settings.LOGOUT_REDIRECT_URL))

    def test_local_user_without_social_account_returns_default_logout_url(self):
        request = self._get_authenticated_request()
        url = self.adapter.get_logout_redirect_url(request)
        self.assertEqual(url, resolve_url(settings.LOGOUT_REDIRECT_URL))

    def test_social_account_with_local_only_behavior_returns_default_logout_url(
        self,
    ):
        SocialAccount.objects.create(
            user=self.user,
            provider='keycloak',
            uid='12345',
            extra_data={'id_token': 'my-id-token'},
        )
        SocialAppCustomData.objects.create(
            social_app=self.social_app,
            logout_behavior=SocialAppCustomData.LogoutBehavior.LOCAL_ONLY,
        )
        request = self._get_authenticated_request()
        url = self.adapter.get_logout_redirect_url(request)
        self.assertEqual(url, resolve_url(settings.LOGOUT_REDIRECT_URL))

    def test_rp_initiated_with_explicit_endpoints(self):
        SocialAccount.objects.create(
            user=self.user,
            provider='keycloak',
            uid='12345',
            extra_data={'id_token': 'my-id-token'},
        )
        SocialAppCustomData.objects.create(
            social_app=self.social_app,
            logout_behavior=SocialAppCustomData.LogoutBehavior.RP_INITIATED,
            end_session_endpoint='https://idp.com/protocol/openid-connect/logout',
            post_logout_redirect_uri='https://kpi.example.com/login/',
        )
        request = self._get_authenticated_request()
        url = self.adapter.get_logout_redirect_url(request)

        parsed = urlparse(url)
        self.assertEqual(parsed.scheme, 'https')
        self.assertEqual(parsed.netloc, 'idp.com')
        self.assertEqual(parsed.path, '/protocol/openid-connect/logout')

        query = parse_qs(parsed.query)
        self.assertEqual(query.get('id_token_hint'), ['my-id-token'])
        self.assertEqual(
            query.get('post_logout_redirect_uri'),
            ['https://kpi.example.com/login/'],
        )
        self.assertEqual(query.get('client_id'), ['kpi-client-id'])

    @responses.activate
    def test_rp_initiated_with_discovery(self):
        self.social_app.settings = {'server_url': 'https://idp.com/auth/realms/kobo'}
        self.social_app.save()

        SocialAccount.objects.create(
            user=self.user,
            provider='keycloak',
            uid='12345',
            extra_data={'id_token': 'discovered-id-token'},
        )
        SocialAppCustomData.objects.create(
            social_app=self.social_app,
            logout_behavior=SocialAppCustomData.LogoutBehavior.RP_INITIATED,
        )

        discovery_url = (
            'https://idp.com/auth/realms/kobo/.well-known/openid-configuration'
        )
        responses.add(
            responses.GET,
            discovery_url,
            json={'end_session_endpoint': 'https://idp.com/auth/realms/kobo/logout'},
            status=200,
        )

        request = self._get_authenticated_request()
        url = self.adapter.get_logout_redirect_url(request)

        parsed = urlparse(url)
        self.assertEqual(parsed.path, '/auth/realms/kobo/logout')
        query = parse_qs(parsed.query)
        self.assertEqual(query.get('id_token_hint'), ['discovered-id-token'])
        self.assertEqual(query.get('client_id'), ['kpi-client-id'])

    def test_prompt_login_syncs_auth_params_in_settings(self):
        custom_data = SocialAppCustomData.objects.create(
            social_app=self.social_app,
            logout_behavior=SocialAppCustomData.LogoutBehavior.PROMPT_LOGIN,
        )
        self.social_app.refresh_from_db()
        self.assertEqual(
            self.social_app.settings.get('auth_params', {}).get('prompt'),
            'login',
        )

        custom_data.logout_behavior = SocialAppCustomData.LogoutBehavior.LOCAL_ONLY
        custom_data.save()
        self.social_app.refresh_from_db()
        self.assertNotIn('prompt', self.social_app.settings.get('auth_params', {}))

    def test_multiple_social_accounts_resolves_deterministically_via_session(self):
        SocialAccount.objects.create(
            user=self.user,
            provider='keycloak',
            uid='kc-uid-1',
            extra_data={'id_token': 'kc-token'},
        )
        azure_app = SocialApp.objects.create(
            provider='openid_connect',
            provider_id='azure',
            name='Azure SSO',
            client_id='azure-client-id',
            secret='azure-secret',
        )
        SocialAccount.objects.create(
            user=self.user,
            provider='azure',
            uid='azure-uid-2',
            extra_data={'id_token': 'azure-token'},
        )
        SocialAppCustomData.objects.create(
            social_app=self.social_app,
            logout_behavior=SocialAppCustomData.LogoutBehavior.RP_INITIATED,
            end_session_endpoint='https://keycloak.example.com/logout',
        )
        SocialAppCustomData.objects.create(
            social_app=azure_app,
            logout_behavior=SocialAppCustomData.LogoutBehavior.RP_INITIATED,
            end_session_endpoint='https://azure.example.com/logout',
        )

        request = self._get_authenticated_request()
        request.session['socialaccount_provider'] = 'keycloak'
        request.session['socialaccount_uid'] = 'kc-uid-1'

        url = self.adapter.get_logout_redirect_url(request)
        parsed = urlparse(url)
        self.assertEqual(parsed.netloc, 'keycloak.example.com')
        query = parse_qs(parsed.query)
        self.assertEqual(query.get('id_token_hint'), ['kc-token'])
        self.assertEqual(query.get('client_id'), ['kpi-client-id'])

    def test_multiple_social_accounts_without_session_context_returns_default_url(self):
        SocialAccount.objects.create(
            user=self.user,
            provider='keycloak',
            uid='kc-uid-1',
            extra_data={'id_token': 'kc-token'},
        )
        SocialAccount.objects.create(
            user=self.user,
            provider='azure',
            uid='azure-uid-2',
            extra_data={'id_token': 'azure-token'},
        )
        SocialAppCustomData.objects.create(
            social_app=self.social_app,
            logout_behavior=SocialAppCustomData.LogoutBehavior.RP_INITIATED,
            end_session_endpoint='https://keycloak.example.com/logout',
        )

        request = self._get_authenticated_request()
        url = self.adapter.get_logout_redirect_url(request)
        self.assertEqual(url, resolve_url(settings.LOGOUT_REDIRECT_URL))

    def test_ambiguous_social_app_returns_default_url(self):
        SocialApp.objects.create(
            provider='openid_connect',
            provider_id='keycloak',
            name='Duplicate Keycloak',
            client_id='kpi-client-id-2',
            secret='kpi-secret-2',
        )
        SocialAccount.objects.create(
            user=self.user,
            provider='keycloak',
            uid='12345',
            extra_data={'id_token': 'my-id-token'},
        )
        SocialAppCustomData.objects.create(
            social_app=self.social_app,
            logout_behavior=SocialAppCustomData.LogoutBehavior.RP_INITIATED,
            end_session_endpoint='https://idp.com/protocol/openid-connect/logout',
        )

        request = self._get_authenticated_request()
        request.session['socialaccount_provider'] = 'keycloak'
        request.session['socialaccount_uid'] = '12345'

        with self.assertLogs('console_logger', level='ERROR'):
            url = self.adapter.get_logout_redirect_url(request)
        self.assertEqual(url, resolve_url(settings.LOGOUT_REDIRECT_URL))

    def test_password_session_returns_default_url_even_with_social_account(
        self,
    ):
        SocialAccount.objects.create(
            user=self.user,
            provider='keycloak',
            uid='12345',
            extra_data={'id_token': 'my-id-token'},
        )
        SocialAppCustomData.objects.create(
            social_app=self.social_app,
            logout_behavior=SocialAppCustomData.LogoutBehavior.RP_INITIATED,
            end_session_endpoint='https://idp.com/protocol/openid-connect/logout',
        )

        request = self._get_authenticated_request()
        request.session[AUTHENTICATION_METHODS_SESSION_KEY] = [
            {'method': 'password', 'at': 1700000000}
        ]

        url = self.adapter.get_logout_redirect_url(request)
        self.assertEqual(url, resolve_url(settings.LOGOUT_REDIRECT_URL))

    def test_pre_social_login_stashes_login_metadata_in_session(self):
        adapter = SocialAccountAdapter()
        account = SocialAccount(
            provider='keycloak',
            uid='kc-uid-1',
            extra_data={'id_token': 'stashed-id-token'},
        )
        sociallogin = SocialLogin(user=self.user, account=account)
        request = self._get_authenticated_request()

        adapter.pre_social_login(request, sociallogin)

        self.assertEqual(request.session.get('oidc_id_token'), 'stashed-id-token')
        self.assertEqual(request.session.get('socialaccount_provider'), 'keycloak')
        self.assertEqual(request.session.get('socialaccount_uid'), 'kc-uid-1')
