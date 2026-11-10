import datetime
import itertools
from unittest.mock import patch

from allauth.account.adapter import get_adapter
from allauth.account.models import EmailAddress
from allauth.mfa.totp.internal.auth import TOTP
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

    def _assert_login_failed(self, response, headless, expected_error_field, expected_error_code):
        if headless:
            assert response.status_code == 400
            assert response.json()['errors'][0]['code'] == expected_error_code
            assert response.json()['errors'][0].get('param') == expected_error_field
        else:
            form = response.context_data['form']
            assert not form.is_valid()
            assert form.errors[expected_error_field] == [get_adapter().error_messages[expected_error_code]]

    def _assert_login_succeeded(self, response, headless):
        if headless:
            assert response.status_code == 200
        else:
            self.assertRedirects(response, reverse(settings.LOGIN_REDIRECT_URL))

    @override_settings(LOGIN_FAILED_RATE_LIMIT='1/1m/key,1/1m/ip')
    @data(
        # headless?, use mfa?, field_for_bad_credential, field_for_rate_limit
        (True, True, 'code', None),
        (True, False, 'password', None),
        (False, True, 'code', '__all__'),
        (False, False, '__all__', '__all__'),
    )
    @unpack
    def test_login_restricted_after_too_many_failures(self, headless, use_mfa, field_for_bad_credential, field_for_rate_limit):
        now = timezone.now()
        one_second_later = now + datetime.timedelta(seconds=1)
        three_minutes_later = now + datetime.timedelta(minutes=3)
        if use_mfa:
            activate_mfa_for_user(self.client, self.u1)
            activate_mfa_for_user(self.client, self.u2)
        with freeze_time(now):
            # bad identifier (password or token), should lock the user and ip
            password = PASSWORD if use_mfa else f'{PASSWORD}bad'
            mfa_code = get_mfa_code_for_user(self.u1) if use_mfa else None
            if mfa_code:
                mfa_code = str(int(mfa_code) + 1)
            response = self._full_login_process(
                headless=headless,
                username=self.u1.username,
                password=password,
                ip='1.2.3.4',
                mfa_code=mfa_code,
            )
            if use_mfa:
                error_code = 'incorrect_code'
            else:
                error_code = 'username_password_mismatch'
            self._assert_login_failed(response, headless, field_for_bad_credential, error_code)

        with freeze_time(one_second_later):
            # different user, same ip, correct identifier, should be blocked
            # at the first (password) request
            response = self._full_login_process(
                headless=headless,
                username=self.u2.username,
                password=PASSWORD,
                ip='1.2.3.4',
            )
            self._assert_login_failed(response, headless, field_for_rate_limit, 'too_many_login_attempts')


            # same user, different ip, correct identifier, still blocked
            response = self._full_login_process(
                headless=headless,
                username=self.u1.username,
                password=PASSWORD,
                ip='5.6.7.8',
            )
            self._assert_login_failed(response, headless, field_for_rate_limit, 'too_many_login_attempts')


        # time travel to after the limit has expired
        with freeze_time(three_minutes_later):
            # should be able to log in as either user at either ip
            for i, (user, ip) in enumerate(itertools.product(
                [self.u1, self.u2], ['1.2.3.4', '5.6.7.8']
            )):
                self.client.logout()
                mfa_code = get_mfa_code_for_user(user) if use_mfa else None
                # cheat so we can re-use mfa_codes since we're generating them under
                # the same timestamp
                with patch.object(TOTP, '_mark_code_used', return_value=True):
                    response = self._full_login_process(
                        headless=headless,
                        username=user.username,
                        password=PASSWORD,
                        ip=ip,
                        mfa_code=mfa_code,
                    )
                    self._assert_login_succeeded(response, headless)
