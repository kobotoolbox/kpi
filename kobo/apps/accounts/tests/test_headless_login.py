from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import Client, TestCase
from django.urls import reverse

from hub.models.sitewide_message import SitewideMessage
from kobo.apps.accounts.mfa.tests.utils import (
    activate_mfa_for_user,
    get_mfa_code_for_user,
)

HEADLESS_LOGIN_URL = '/api/v2/allauth/browser/v1/auth/login'
HEADLESS_SESSION_URL = '/api/v2/allauth/browser/v1/auth/session'
HEADLESS_MFA_AUTHENTICATE_URL = '/api/v2/allauth/browser/v1/auth/2fa/authenticate'
HEADLESS_APP_LOGIN_URL = '/api/v2/allauth/app/v1/auth/login'
HEADLESS_APP_SESSION_URL = '/api/v2/allauth/app/v1/auth/session'
HEADLESS_SIGNUP_URL = '/api/v2/allauth/browser/v1/auth/signup'
PASSWORD = 'a-Sufficiently-Long-Passphrase-42'


class UnverifiedLoginConfirmationEmailTestCase(TestCase):
    """
    An unverified user logging in through the headless API is not sent another
    confirmation link; the SPA offers an explicit resend instead. The templated
    pages keep sending one until they are retired
    """

    def setUp(self):
        self.client = Client()
        self.user = get_user_model().objects.create_user(
            username='unverified', email='unverified@example.com', password=PASSWORD
        )
        EmailAddress.objects.update_or_create(
            user=self.user,
            email='unverified@example.com',
            defaults={'primary': True, 'verified': False},
        )

    def test_headless_login_sends_no_email(self):
        response = self.client.post(
            HEADLESS_LOGIN_URL,
            {'username': 'unverified', 'password': PASSWORD},
            content_type='application/json',
        )

        # The login is still held back pending verification, so the SPA knows
        # to show the resend button
        assert response.status_code == 401, response.content
        pending_flows = [
            flow['id']
            for flow in response.json()['data']['flows']
            if flow.get('is_pending')
        ]
        assert pending_flows == ['verify_email']
        assert len(mail.outbox) == 0

    def test_templated_login_still_sends_email(self):
        response = self.client.post(
            reverse('account_login'),
            {'login': 'unverified', 'password': PASSWORD},
        )

        assert response.status_code == 302
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ['unverified@example.com']

    def test_headless_signup_still_sends_activation_email(self):
        SitewideMessage.objects.create(slug='terms_of_service', body='tos agreement')
        response = self.client.post(
            HEADLESS_SIGNUP_URL,
            {
                'username': 'newcomer',
                'email': 'newcomer@example.com',
                'password': PASSWORD,
                'terms_of_service': True,
            },
            content_type='application/json',
        )

        assert response.status_code == 401, response.content
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ['newcomer@example.com']


class SwitchAccountLoginTestCase(TestCase):
    """
    Logging in through the headless API while already authenticated switches to
    the new account instead of answering 409, like the templated login page
    """

    def setUp(self):
        self.client = Client()
        self.current_user = self._create_verified_user('current')
        self.other_user = self._create_verified_user('other')

    def test_login_as_other_user_switches_account(self):
        self.client.force_login(self.current_user)

        response = self._login('other')

        assert response.status_code == 200, response.content
        assert response.json()['data']['user']['username'] == 'other'
        assert self._session_username() == 'other'

    def test_failed_login_keeps_current_session(self):
        self.client.force_login(self.current_user)

        response = self._login('other', password='wrong-password')

        assert response.status_code == 400, response.content
        assert self._session_username() == 'current'

    def test_login_as_same_user_keeps_session(self):
        self.client.force_login(self.current_user)
        session_key = self.client.session.session_key

        response = self._login('current')

        assert response.status_code == 200, response.content
        assert response.json()['data']['user']['username'] == 'current'
        assert self.client.session.session_key == session_key

    def test_login_as_other_user_with_mfa_enforces_mfa(self):
        activate_mfa_for_user(self.client, self.other_user)
        self.client.force_login(self.current_user)

        response = self._login('other')

        # The new login waits on its 2FA challenge, on a session that no longer
        # belongs to the previous user
        assert response.status_code == 401, response.content
        pending_flows = [
            flow['id']
            for flow in response.json()['data']['flows']
            if flow.get('is_pending')
        ]
        assert pending_flows == ['mfa_authenticate']
        assert self._session_username() is None

        response = self.client.post(
            HEADLESS_MFA_AUTHENTICATE_URL,
            {'code': get_mfa_code_for_user(self.other_user)},
            content_type='application/json',
        )

        assert response.status_code == 200, response.content
        assert self._session_username() == 'other'

    def test_app_client_login_as_other_user_switches_account(self):
        response = self.client.post(
            HEADLESS_APP_LOGIN_URL,
            {'username': 'current', 'password': PASSWORD},
            content_type='application/json',
        )
        assert response.status_code == 200, response.content
        session_token = response.json()['meta']['session_token']

        response = self.client.post(
            HEADLESS_APP_LOGIN_URL,
            {'username': 'other', 'password': PASSWORD},
            content_type='application/json',
            HTTP_X_SESSION_TOKEN=session_token,
        )

        assert response.status_code == 200, response.content
        assert response.json()['data']['user']['username'] == 'other'
        new_session_token = response.json()['meta']['session_token']
        assert new_session_token != session_token
        # The previous user's token is gone; allauth reports it as expired
        response = self.client.get(
            HEADLESS_APP_SESSION_URL, HTTP_X_SESSION_TOKEN=session_token
        )
        assert response.status_code == 410

    @staticmethod
    def _create_verified_user(username):
        user = get_user_model().objects.create_user(
            username=username, email=f'{username}@example.com', password=PASSWORD
        )
        EmailAddress.objects.update_or_create(
            user=user,
            email=f'{username}@example.com',
            defaults={'primary': True, 'verified': True},
        )
        return user

    def _login(self, username, password=PASSWORD):
        return self.client.post(
            HEADLESS_LOGIN_URL,
            {'username': username, 'password': password},
            content_type='application/json',
        )

    def _session_username(self):
        response = self.client.get(HEADLESS_SESSION_URL)
        if response.status_code != 200:
            return None
        return response.json()['data']['user']['username']
