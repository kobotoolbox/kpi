import datetime
import itertools
from abc import ABCMeta, abstractmethod
from contextlib import ExitStack
from unittest.mock import patch

import django
from allauth.account.adapter import get_adapter
from allauth.account.models import EmailAddress
from allauth.mfa.totp.internal.auth import TOTP
from ddt import data, ddt, unpack
from django.conf import settings
from django.core.cache import cache
from django.test import Client, RequestFactory, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from freezegun import freeze_time
from rest_framework import status
from rest_framework.exceptions import Throttled

from kobo.apps.accounts.mfa.tests.utils import (
    activate_mfa_for_user,
    get_mfa_code_for_user,
)
from kobo.apps.accounts.throttling import SETTINGS_BY_SCOPE, rate_limit
from kobo.apps.kobo_auth.shortcuts import User

PASSWORD = 'a-Sufficiently-Long-Passphrase-42'
ERROR_CODE_RATE_LIMITED = 'too_many_login_attempts'
IP_1 = '1.2.3.4'
IP_2 = '5.6.7.8'


@ddt
@override_settings(LOGIN_FAILED_RATE_LIMIT='1/1m/ip,1/1m/key')
@override_settings(ACCOUNT_RATE_LIMITS=False)
class BaseRateLimitTestCase(TestCase, metaclass=ABCMeta):
    login_url_name = None
    mfa_authenticate_url_name = None
    mfa_reauthenticate_url_name = None
    content_headers = {}
    # there are slight variations across allauth how errors are reported at different
    # stages of login and with headless vs templated
    mfa_rate_limited_field = None
    password_rate_limited_field = None
    bad_password_field = None

    @abstractmethod
    def assert_failure(self, response, expected_error_field, expected_error_code):
        pass

    @abstractmethod
    def assert_mfa_success(self, response):
        pass

    @abstractmethod
    def assert_password_success(self, response, mfa):
        pass

    @abstractmethod
    def login_with_password(self, user, password, ip):
        pass

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
        self.now = timezone.now()
        self.one_second_later = self.now + datetime.timedelta(seconds=1)
        self.three_minutes_later = self.now + datetime.timedelta(minutes=3)
        # allow tests to reuse mfa codes for easier testing
        code_used_patch = patch.object(TOTP, '_mark_code_used', return_value=True)
        code_used_patch.start()
        self.addCleanup(code_used_patch.stop)


@ddt
class RateLimitTestMixin:
    @staticmethod
    def _create_bad_token(user):
        mfa_code = get_mfa_code_for_user(user)
        return str(int(mfa_code) + 1)

    def assert_all_logins_succeed(self, mfa):
        for user, ip in itertools.product([self.u1, self.u2], [IP_1, IP_2]):
            self.client.logout()
            mfa_code = get_mfa_code_for_user(user) if mfa else None
            response = self.login_with_password(user, password=PASSWORD, ip=ip)
            self.assert_password_success(response, mfa)
            if mfa:
                response = self.mfa_authenticate(token=mfa_code, ip=ip)
                self.assert_mfa_success(response)

    def login_with_bad_token(self, user, ip):
        response = self.login_with_password(user=user, password=PASSWORD, ip=ip)
        self.assert_password_success(response=response, mfa=True)
        bad_code = self._create_bad_token(user)
        response = self.mfa_authenticate(token=bad_code, ip=ip)
        self.assert_failure(
            response=response,
            expected_error_field='code',
            expected_error_code='incorrect_code',
        )

    def mfa_authenticate(self, token, ip):
        return self.client.post(
            path=reverse(self.mfa_authenticate_url_name),
            data={'code': token},
            REMOTE_ADDR=ip,
            **self.content_headers,
        )

    @data(
        # change user?, change ip?, expect error?,
        (True, True, False),
        (True, False, True),
        (False, True, True),
        (False, False, True),
    )
    @unpack
    def test_mfa_user_cannot_login_with_password_when_rate_limited(
        self, change_user, change_ip, expect_error
    ):
        activate_mfa_for_user(self.client, self.u1)
        activate_mfa_for_user(self.client, self.u2)
        current_user = self.u1
        current_ip = IP_1
        # correct password, incorrect token
        self.login_with_bad_token(user=current_user, ip=current_ip)
        if change_user:
            current_user = self.u2
        if change_ip:
            current_ip = IP_2
        # attempt to log in with the correct password
        with freeze_time(self.one_second_later):
            response = self.login_with_password(current_user, PASSWORD, current_ip)
            # rate limited!
            if expect_error:
                self.assert_failure(
                    response,
                    expected_error_field=self.password_rate_limited_field,
                    expected_error_code=ERROR_CODE_RATE_LIMITED,
                )
            else:
                self.assert_password_success(response=response, mfa=True)
        with freeze_time(self.three_minutes_later):
            self.assert_all_logins_succeed(mfa=True)

    def test_mfa_user_cannot_use_mfa_token_when_rate_limited(self):
        activate_mfa_for_user(self.client, self.u1)
        activate_mfa_for_user(self.client, self.u2)
        current_user = self.u1
        current_ip = IP_1
        with freeze_time(self.now):
            self.login_with_bad_token(user=current_user, ip=current_ip)

        # attempt to use the correct code
        with freeze_time(self.one_second_later):
            mfa_code = get_mfa_code_for_user(current_user)
            response = self.mfa_authenticate(token=mfa_code, ip=current_ip)
            self.assert_failure(
                response,
                expected_error_field='code',
                expected_error_code=ERROR_CODE_RATE_LIMITED,
            )

            # change ip and try again
            current_ip = IP_2
            response = self.mfa_authenticate(token=mfa_code, ip=current_ip)
            self.assert_failure(
                response,
                expected_error_field='code',
                expected_error_code=ERROR_CODE_RATE_LIMITED,
            )

        with freeze_time(self.three_minutes_later):
            self.assert_all_logins_succeed(mfa=True)

    def test_non_mfa_login_restricted_after_too_many_failures(self):
        with freeze_time(self.now):
            response = self.login_with_password(
                user=self.u1, password=f'{PASSWORD}bad', ip=IP_1
            )
            self.assert_failure(
                response,
                expected_error_field=self.bad_password_field,
                expected_error_code='username_password_mismatch',
            )

        with freeze_time(self.one_second_later):
            # different user, same ip, correct password, should be blocked
            response = self.login_with_password(
                user=self.u2, password=PASSWORD, ip=IP_1
            )
            self.assert_failure(
                response, self.password_rate_limited_field, ERROR_CODE_RATE_LIMITED
            )

            # same user, different ip, correct identifier, still blocked
            response = self.login_with_password(
                user=self.u2, password=PASSWORD, ip=IP_1
            )
            self.assert_failure(
                response, self.password_rate_limited_field, ERROR_CODE_RATE_LIMITED
            )

        # time travel to after the limit has expired
        with freeze_time(self.three_minutes_later):
            self.assert_all_logins_succeed(mfa=False)

    def test_reauthentication_is_rate_limited(self):
        activate_mfa_for_user(self.client, self.u1)
        # force login to simulate a stolen session
        self.client.force_login(self.u1)
        with freeze_time(self.now):
            bad_token = self._create_bad_token(self.u1)
            response = self.client.post(
                path=reverse(self.mfa_reauthenticate_url_name),
                data={'code': bad_token},
                **self.content_headers,
            )
            self.assert_failure(
                response,
                expected_error_field='code',
                expected_error_code='incorrect_code',
            )

        with freeze_time(self.one_second_later):
            code = get_mfa_code_for_user(self.u1)
            response = self.client.post(
                path=reverse(self.mfa_reauthenticate_url_name),
                data={'code': code},
                **self.content_headers,
            )
            self.assert_failure(
                response,
                expected_error_field='code',
                expected_error_code=ERROR_CODE_RATE_LIMITED,
            )


@ddt
class HeadlessRateLimitTestCase(BaseRateLimitTestCase, RateLimitTestMixin):

    login_url_name = 'headless:browser:account:login'
    mfa_authenticate_url_name = 'headless:browser:mfa:authenticate'
    mfa_reauthenticate_url_name = 'headless:browser:mfa:reauthenticate'
    content_headers = {'content_type': 'application/json'}
    bad_password_field = 'password'

    def assert_failure(self, response, expected_error_field, expected_error_code):
        assert response.status_code == 400
        assert response.json()['errors'][0]['code'] == expected_error_code
        assert response.json()['errors'][0].get('param') == expected_error_field

    def assert_mfa_success(self, response):
        assert response.status_code == status.HTTP_200_OK

    def assert_password_success(self, response, mfa):
        if mfa:
            assert response.status_code == 401
            authentication_flow = next(
                flow
                for flow in response.json()['data']['flows']
                if flow['id'] == 'mfa_authenticate'
            )
            assert authentication_flow['is_pending'] is True
        else:
            assert response.status_code == 200

    def login_with_password(self, user, password, ip):
        request_data = {'username': user.username, 'password': password}
        return self.client.post(
            path=reverse(self.login_url_name),
            data=request_data,
            REMOTE_ADDR=ip,
            **self.content_headers,
        )

    def test_regenerate_codes_is_rate_limited(self):
        activate_mfa_for_user(self.client, self.u1)
        self.client.force_login(self.u1)
        # force login to imitate a stolen session
        now = timezone.now()
        one_second_later = now + datetime.timedelta(seconds=1)
        with freeze_time(now):
            response = self.client.post(
                path=reverse('mfa-regenerate', args=('app',)),
                data={'code': '1234567890'},
            )
            assert response.status_code == status.HTTP_400_BAD_REQUEST
            assert response.json()['code'][0] == 'Invalid code'
        with freeze_time(one_second_later):
            code = get_mfa_code_for_user(self.u1)
            response = self.client.post(
                reverse('mfa-regenerate', args=('app',)), data={'code': code}
            )
            assert response.status_code == status.HTTP_400_BAD_REQUEST
            assert (
                response.json()['code'][0]
                == 'Too many failed login attempts. Try again later.'
            )


class TemplatedRateLimitTestCase(BaseRateLimitTestCase, RateLimitTestMixin):
    login_url_name = 'account_login'
    mfa_authenticate_url_name = 'mfa_authenticate'
    mfa_reauthenticate_url_name = 'mfa_reauthenticate'
    bad_password_field = '__all__'
    password_rate_limited_field = '__all__'

    def assert_failure(self, response, expected_error_field, expected_error_code):
        form = response.context_data['form']
        assert not form.is_valid()
        assert form.errors[expected_error_field] == [
            get_adapter().error_messages[expected_error_code]
        ]

    def assert_mfa_success(self, response):
        self.assertRedirects(response, reverse(settings.LOGIN_REDIRECT_URL))

    def assert_password_success(self, response, mfa):
        if mfa:
            self.assertRedirects(response, reverse(self.mfa_authenticate_url_name))
        else:
            self.assertRedirects(response, reverse(settings.LOGIN_REDIRECT_URL))

    def login_with_password(self, user, password, ip):
        request_data = {'login': user.username, 'password': password}
        return self.client.post(
            path=reverse(self.login_url_name),
            data=request_data,
            REMOTE_ADDR=ip,
            **self.content_headers,
        )


@ddt
class RateLimitingContextManagerTestCase(TestCase):
    # plumbing tests for the context manager

    def setUp(self) -> None:
        self.scope = 'something'
        patched_settings = patch.dict(
            SETTINGS_BY_SCOPE, {self.scope: 'SOME_RATE_LIMIT'}
        )
        patched_settings.start()
        self.addCleanup(patched_settings.stop)
        cache.clear()

    @override_settings(SOME_RATE_LIMIT='2/1m/key,2/1m/ip')
    def test_rate_limit_raises_exception_after_too_many_calls(self):
        request = RequestFactory().post('/')

        def dummy_func():
            with rate_limit(self.scope, username='fred', request=request):
                pass

        now = timezone.now()
        one_second_later = now + datetime.timedelta(seconds=1)
        with freeze_time(now):
            dummy_func()
            dummy_func()
        with freeze_time(one_second_later):
            with self.assertRaises(Throttled):
                dummy_func()

    @override_settings(SOME_RATE_LIMIT='2/1m/key,2/1m/ip')
    def test_rate_limit_rolls_back_with_signal(self):
        some_signal = django.dispatch.Signal()

        request = RequestFactory().post('/')

        def dummy_func():
            with rate_limit(
                self.scope,
                username='fred',
                request=request,
                rollback_signal=some_signal,
            ):
                some_signal.send(sender=None, request=request)

        now = timezone.now()
        one_second_later = now + datetime.timedelta(seconds=1)
        with freeze_time(now):
            dummy_func()
            dummy_func()
        with freeze_time(one_second_later):
            dummy_func()

    @override_settings(SOME_RATE_LIMIT='2/1m/key,2/1m/ip')
    def test_rate_limit_does_not_rollback_if_request_doesnt_match(self):
        some_signal = django.dispatch.Signal()

        request1 = RequestFactory().post('/')
        request2 = RequestFactory().post('/')

        def dummy_func():
            with rate_limit(
                self.scope,
                username='fred',
                request=request1,
                rollback_signal=some_signal,
            ):
                some_signal.send(sender=None, request=request2)

        now = timezone.now()
        one_second_later = now + datetime.timedelta(seconds=1)
        with freeze_time(now):
            dummy_func()
            dummy_func()
        with freeze_time(one_second_later):
            with self.assertRaises(Throttled):
                dummy_func()

    def test_rate_limit_unknown_scope(self):
        request = RequestFactory().post('/')
        with self.assertRaises(KeyError):
            with rate_limit('unknown_scope', username='fred', request=request):
                pass

    @override_settings(LOGIN_FAILED_RATE_LIMIT=None)
    def test_rate_limit_missing_configuration(self):
        request = RequestFactory().post('/')
        with patch(
            'kobo.apps.accounts.throttling.single_rate_limit'
        ) as rate_limiting_mock:
            with rate_limit('login_failed', username='fred', request=request):
                pass
        rate_limiting_mock.assert_not_called()

    @override_settings(LOGIN_FAILED_RATE_LIMIT='1/2m/bananas')
    @data(
        ('bananas', ValueError),
        ('1/2m/bananas', ValueError),
        ('1/2m/key,1/2m/bananas', ValueError),
    )
    @unpack
    def test_rate_limit_malformed_configuration(self, setting, exception):
        request = RequestFactory().post('/')
        with ExitStack() as stack:
            stack.enter_context(override_settings(LOGIN_FAILED_RATE_LIMIT=setting))
            rate_limiting_mock = stack.enter_context(
                patch('kobo.apps.accounts.throttling.single_rate_limit')
            )
            stack.enter_context(self.assertRaises(exception))
            stack.enter_context(
                rate_limit('login_failed', username='fred', request=request)
            )
            pass
        rate_limiting_mock.assert_not_called()

    def test_rate_limit_does_not_apply_to_get_requests(self):
        request = RequestFactory().get('/')

        def dummy_func():
            with rate_limit(self.scope, username='fred', request=request):
                pass

        now = timezone.now()
        one_second_later = now + datetime.timedelta(seconds=1)
        with freeze_time(now):
            dummy_func()
            dummy_func()
        with freeze_time(one_second_later):
            dummy_func()
