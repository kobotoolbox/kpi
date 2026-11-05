from allauth.headless import app_settings as headless_settings
from ddt import data, ddt, unpack
from django.conf import settings
from django.test import Client, TestCase, override_settings
from django.urls import Resolver404, resolve, reverse
from model_bakery import baker

from kobo.apps.openrosa.apps.main.models import UserProfile
from .utils import record_authentication

HEADLESS_EMAIL_URL = '/api/v2/allauth/{client}/v1/account/email'
METHODS = ('get', 'post', 'put', 'patch', 'delete')


@ddt
@override_settings(ACCOUNT_RATE_LIMITS=False)
class BlockedAllauthEmailEndpointsTestCase(TestCase):
    """
    `/me/emails/` is the only way to change an email address, so allauth's own
    email management endpoints must not be reachable
    """

    def setUp(self):
        # An organization owner who has just re-authenticated, i.e. someone
        # `/me/emails/` would let change their address
        self.user = baker.make(settings.AUTH_USER_MODEL)
        baker.make(
            'account.emailaddress',
            user=self.user,
            email='owner@example.com',
            primary=True,
            verified=True,
        )
        assert self.user.organization.is_owner(self.user)
        self.client = self._login(Client(enforce_csrf_checks=True))

    def _login(self, client):
        client.force_login(self.user)
        record_authentication(client)
        return client

    def _assert_email_unchanged(self):
        assert list(
            self.user.emailaddress_set.values_list('email', 'primary', 'verified')
        ) == [('owner@example.com', True, True)]

    @data(*headless_settings.CLIENTS)
    def test_headless_manage_email_is_not_routed(self, client):
        # Excluded from allauth's routes, not merely masked by an earlier one
        with self.assertRaises(Resolver404):
            resolve(HEADLESS_EMAIL_URL.format(client=client))

    @data(
        *[
            (client, method)
            for client in headless_settings.CLIENTS
            for method in METHODS
        ]
    )
    @unpack
    def test_headless_manage_email_is_not_found(self, client, method):
        response = getattr(self.client, method)(
            HEADLESS_EMAIL_URL.format(client=client),
            data={'email': 'foo@example.com'},
            content_type='application/json',
        )

        assert response.status_code == 404
        self._assert_email_unchanged()

    @data('post', 'delete')
    def test_headless_manage_email_is_not_found_with_unvalidated_password(
        self, method
    ):
        # `RestrictedAccessMiddleware` must keep the 404, not swap it for its
        # 403 page and then crash
        UserProfile.objects.update_or_create(
            user=self.user, defaults={'validated_password': False}
        )
        client = self._login(Client(raise_request_exception=False))

        response = getattr(client, method)(
            HEADLESS_EMAIL_URL.format(client='browser'),
            data={'email': 'foo@example.com'},
            content_type='application/json',
        )

        assert response.status_code == 404
        self._assert_email_unchanged()

    @data(*headless_settings.CLIENTS)
    def test_headless_manage_email_is_not_found_when_anonymous(self, client):
        self.client.logout()

        response = self.client.get(HEADLESS_EMAIL_URL.format(client=client))

        assert response.status_code == 404

    @data(*METHODS)
    def test_templated_email_page_redirects_to_account_settings(self, method):
        # Without CSRF enforcement, so every method reaches the redirect
        client = self._login(Client())

        response = getattr(client, method)(
            '/accounts/email/',
            data={'email': 'foo@example.com', 'action_add': ''},
        )

        assert response.status_code == 302
        assert response['Location'] == '/#/account/settings'
        self._assert_email_unchanged()

    def test_templated_email_page_write_without_csrf_token_changes_nothing(self):
        response = self.client.post(
            '/accounts/email/', data={'email': 'foo@example.com', 'action_add': ''}
        )

        assert response.status_code == 403
        self._assert_email_unchanged()

    def test_account_email_still_reverses_to_the_redirect(self):
        # allauth reverses this name itself (email verification views,
        # templates); removing it would raise `NoReverseMatch` there
        assert reverse('account_email') == '/accounts/email/'

    def test_headless_namespaces_still_reverse(self):
        assert (
            reverse('headless:browser:account:current_session')
            == '/api/v2/allauth/browser/v1/auth/session'
        )

    def test_headless_email_verification_is_still_routed(self):
        # Signup activation uses this endpoint; only `account/email` is excluded
        response = self.client.get(
            '/api/v2/allauth/browser/v1/auth/email/verify',
            HTTP_X_EMAIL_VERIFICATION_KEY='not-a-real-key',
        )

        assert response.status_code != 404

    def test_schema_excludes_blocked_endpoint(self):
        from kpi.utils.spectacular_processing import merge_allauth_headless_schema

        # allauth drops spec paths that don't resolve, so excluding the route is
        # enough to keep it out of the schema
        result = merge_allauth_headless_schema(
            {'paths': {}}, generator=None, request=None, public=True
        )

        for client in ('browser', 'app'):
            assert f'/api/v2/allauth/{client}/v1/account/email' not in result['paths']
            assert f'/api/v2/allauth/{client}/v1/auth/email/verify' in result['paths']
