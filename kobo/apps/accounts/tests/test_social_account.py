from allauth.core.exceptions import ImmediateHttpResponse
from allauth.socialaccount.models import SocialAccount, SocialLogin
from allauth.socialaccount.providers.base.constants import AuthProcess
from django.conf import settings
from django.contrib.messages.storage.fallback import FallbackStorage
from django.contrib.sessions.middleware import SessionMiddleware
from django.test import RequestFactory, TestCase
from django.urls import reverse
from model_bakery import baker
from rest_framework.test import APITestCase

from kobo.apps.accounts.adapter import SocialAccountAdapter
from kpi.utils.fuzzy_int import FuzzyInt


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
        # messages.error needs a session + message store
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

        with self.assertRaises(ImmediateHttpResponse):
            self.adapter.pre_social_login(request, sociallogin)

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
