import datetime
import itertools

from allauth.account.models import EmailAddress
from ddt import data, ddt, unpack
from django.conf import settings
from django.core.cache import cache
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from freezegun import freeze_time

from kobo.apps.accounts.mfa.tests.utils import (
    activate_mfa_for_user,
    get_mfa_code_for_user,
)
from kobo.apps.kobo_auth.shortcuts import User

HEADLESS_LOGIN_URL = '/api/v2/allauth/browser/v1/auth/login'
HEADLESS_MFA_URL = '/api/v2/allauth/browser/v1/auth/2fa/authenticate'

PASSWORD = 'a-Sufficiently-Long-Passphrase-42'


@ddt
class RateLimitTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.client = Client()
        self.u1 = User.objects.create_user(
            username='one', password=PASSWORD, email='one@example.com'
        )
        self.u2 = User.objects.create_user(
            username='two', password=PASSWORD, email='two@example.com'
        )
        # verify users so a successful login returns 200 instead of 401
        EmailAddress.objects.create(
            user=self.u1, email=self.u1.email, primary=True, verified=True
        )
        EmailAddress.objects.create(
            user=self.u2, email=self.u2.email, primary=True, verified=True
        )

    def _full_login_process_no_mfa(self, headless, username, password, ip):
        login_url = HEADLESS_LOGIN_URL if headless else reverse('kobo_login')
        username_key = 'username' if headless else 'login'
        request_data = {username_key: username, 'password': password}
        extra_args = {'content_type': 'application/json'} if headless else {}
        return self.client.post(
            login_url, data=request_data, REMOTE_ADDR=ip, **extra_args
        )

    def _full_login_process_with_mfa(self, headless, username, password, ip, mfa_code):
        self._full_login_process_no_mfa(headless, username, password, ip)
        extra_args = {'content_type': 'application/json'} if headless else {}
        mfa_authenticate_url = (
            HEADLESS_MFA_URL if headless else reverse('mfa_authenticate')
        )
        return self.client.post(
            mfa_authenticate_url, data={'code': mfa_code}, REMOTE_ADDR=ip, **extra_args
        )

    def _full_login_process(self, headless, username, password, ip, mfa_code=None):
        if mfa_code:
            return self._full_login_process_with_mfa(
                headless, username, password, ip, mfa_code
            )
        return self._full_login_process_no_mfa(headless, username, password, ip)

    def _assert_login_failed(self, response, headless, expected_allauth_error_code):
        if headless:
            assert response.status_code == 400
            if expected_allauth_error_code:
                assert (
                    response.json()['errors'][0]['code'] == expected_allauth_error_code
                )
        else:
            form = response.context_data['form']
            assert not form.is_valid()

    def _assert_login_succeeded(self, response, headless):
        if headless:
            assert response.status_code == 200
        else:
            self.assertRedirects(response, reverse(settings.LOGIN_REDIRECT_URL))

    @override_settings(ACCOUNT_RATE_LIMITS={'login_failed': '1/2m/ip,1/2m/key'})
    @data(
        # headless?, use mfa?
        (True, True),
        (True, False),
        (False, True),
        (False, False),
    )
    @unpack
    def test_login_restricted_after_too_many_failures(self, headless, use_mfa):
        now = timezone.now()
        one_second_later = now + datetime.timedelta(seconds=1)
        three_minutes_later = now + datetime.timedelta(minutes=3)
        if use_mfa:
            activate_mfa_for_user(self.client, self.u1)
            activate_mfa_for_user(self.client, self.u2)
        with freeze_time(now):
            # bad identifier (password or token), should lock the user and ip
            password = PASSWORD if use_mfa else f'{PASSWORD}bad'
            code = get_mfa_code_for_user(self.u1) if use_mfa else None
            if code:
                code = int(code) + 1
                code = str(code)
            response = self._full_login_process(
                headless=headless,
                username=self.u1.username,
                password=password,
                ip='1.2.3.4',
                mfa_code=code,
            )
            expected_error_code = None if use_mfa else 'username_password_mismatch'
            self._assert_login_failed(response, headless, expected_error_code)

        with freeze_time(one_second_later):
            # different user, same ip, correct identifier, should still be blocked
            code = get_mfa_code_for_user(self.u2) if use_mfa else None
            if code:
                code = int(code) + 1
                code = str(code)
            response = self._full_login_process(
                headless=headless,
                username=self.u2.username,
                password=PASSWORD,
                ip='1.2.3.4',
                mfa_code=code,
            )
            expected_error_code = None if use_mfa else 'too_many_login_attempts'
            self._assert_login_failed(response, headless, expected_error_code)

            # same user, different ip, correct identifier, still blocked
            code = get_mfa_code_for_user(self.u1) if use_mfa else None
            if code:
                code = int(code) + 1
                code = str(code)
            response = self._full_login_process(
                headless=headless,
                username=self.u1.username,
                password=PASSWORD,
                ip='5.6.7.8',
                mfa_code=code,
            )
            print(f'{response.status_code}\n')
            expected_error_code = None if use_mfa else 'too_many_login_attempts'
            self._assert_login_failed(response, headless, expected_error_code)

        # time travel to after the limit has expired
        with freeze_time(three_minutes_later):
            # should be able to log in as either user at either ip
            for user, ip in itertools.product(
                [self.u1, self.u2], ['1.2.3.4', '5.6.7.8']
            ):
                code = get_mfa_code_for_user(user) if use_mfa else None
                response = self._full_login_process(
                    headless=headless,
                    username=user.username,
                    password=PASSWORD,
                    ip=ip,
                    mfa_code=code,
                )
                self._assert_login_succeeded(response, headless)
                # clear the cache so we can re-use mfa tokens
                cache.clear()
