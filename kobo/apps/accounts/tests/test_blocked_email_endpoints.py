from allauth.headless import app_settings as headless_settings
from ddt import data, ddt, unpack
from django.conf import settings
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from model_bakery import baker

from .utils import record_authentication

HEADLESS_EMAIL_URL = '/api/v2/allauth/{client}/v1/account/email'
METHODS = ('get', 'post', 'put', 'patch', 'delete')


@ddt
@override_settings(ACCOUNT_RATE_LIMITS=False)
class BlockedAllauthEmailEndpointsTestCase(TestCase):
    """
    allauth's own email management endpoints skip every rule `/me/emails/`
    enforces, so they must not be reachable at all
    """

    def setUp(self):
        # Enforce CSRF like a real browser: the block must not depend on a
        # missing token to reject writes
        self.client = Client(enforce_csrf_checks=True)
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
        self.client.force_login(self.user)
        record_authentication(self.client)

    def _assert_email_unchanged(self):
        assert list(
            self.user.emailaddress_set.values_list('email', 'primary', 'verified')
        ) == [('owner@example.com', True, True)]

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
            data={'email': 'attacker@example.com'},
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
        response = getattr(self.client, method)(
            '/accounts/email/',
            data={'email': 'attacker@example.com', 'action_add': ''},
        )

        assert response.status_code == 302
        assert response['Location'] == '/#/account/settings'
        self._assert_email_unchanged()

    def test_account_email_still_reverses_to_the_blocked_page(self):
        # allauth reverses this name itself (email verification views,
        # templates); removing it would raise `NoReverseMatch` there
        assert reverse('account_email') == '/accounts/email/'

    def test_headless_email_verification_is_still_routed(self):
        # Signup activation uses this endpoint; only `account/email` is blocked
        response = self.client.get(
            '/api/v2/allauth/browser/v1/auth/email/verify',
            HTTP_X_EMAIL_VERIFICATION_KEY='not-a-real-key',
        )

        assert response.status_code != 404

    def test_schema_excludes_blocked_endpoint(self):
        from allauth.headless.spec.internal.schema import get_schema

        from kpi.utils.spectacular_processing import merge_allauth_headless_schema

        result = merge_allauth_headless_schema(
            {'paths': {}}, generator=None, request=None, public=True
        )

        # Guards against allauth renaming the path, which would silently
        # stop the filter from matching
        assert '/api/v2/allauth/{client}/v1/account/email' in get_schema()['paths']
        for client in ('browser', 'app'):
            assert f'/api/v2/allauth/{client}/v1/account/email' not in result['paths']
            assert (
                f'/api/v2/allauth/{client}/v1/auth/email/verify' in result['paths']
            )
