import base64
from unittest.mock import patch

from allauth.account.models import EmailAddress
from ddt import data, ddt
from django.conf import settings
from django.core import mail
from django.test import override_settings
from django.urls import reverse
from model_bakery import baker
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase
from rest_framework.throttling import ScopedRateThrottle

from kpi.utils.fuzzy_int import FuzzyInt
from .utils import clear_email_change_throttle, record_authentication


@override_settings(ACCOUNT_RATE_LIMITS=False)
class AccountsEmailTestCase(APITestCase):
    def setUp(self):
        self.user = baker.make(settings.AUTH_USER_MODEL)
        self.client.force_login(self.user)
        record_authentication(self.client)
        clear_email_change_throttle(self.user)
        self.url_list = reverse('emailaddress-list')

    def test_list(self):
        user_email = baker.make('account.emailaddress', user=self.user)
        other_email = baker.make('account.emailaddress')
        # Auth, Count, Queryset
        queries = FuzzyInt(3, 5)
        with self.assertNumQueries(queries):
            res = self.client.get(self.url_list)
        self.assertContains(res, user_email.email)
        self.assertNotContains(res, other_email.email)

    def test_new_email(self):
        email = baker.make(
            'account.emailaddress', user=self.user, primary=True, verified=True
        )

        # Add first new unconfirmed email
        data = {'email': 'new@example.com'}
        res = self.client.post(self.url_list, data, format='json')
        self.assertContains(res, data['email'], status_code=201)
        self.assertEqual(self.user.emailaddress_set.count(), 2)
        self.assertEqual(
            self.user.emailaddress_set.filter(verified=False).count(), 1
        )
        self.assertEqual(len(mail.outbox), 1)

        res = self.client.post(self.url_list, data, format='json')
        self.assertEqual(
            self.user.emailaddress_set.filter(verified=False).count(),
            1,
            'Ignore duplicate emails',
        )

        # Add second unconfirmed email, overrides the first
        data = {'email': 'morenew@example.com'}
        # Auth, re-authentication check, Select, Delete (many), Get or Create
        queries = FuzzyInt(11, 22)
        with self.assertNumQueries(queries):
            res = self.client.post(self.url_list, data, format='json')
        self.assertContains(res, data['email'], status_code=201)
        self.assertEqual(self.user.emailaddress_set.count(), 2)
        self.assertEqual(
            self.user.emailaddress_set.filter(verified=False).count(), 1
        )
        self.assertEqual(len(mail.outbox), 2)

    def test_delete_email(self):
        baker.make('account.emailaddress', user=self.user)
        primary_email = baker.make(
            'account.emailaddress', user=self.user, verified=True, primary=True
        )

        res = self.client.delete(self.url_list)
        self.assertEqual(res.status_code, 204)
        self.assertEqual(self.user.emailaddress_set.count(), 1)
        self.assertTrue(
            self.user.emailaddress_set.filter(pk=primary_email.pk).exists()
        )

    def test_new_confirm_email(self):
        baker.make(
            'account.emailaddress', user=self.user, primary=True, verified=True
        )
        data = {'email': 'new@example.com'}
        res = self.client.post(self.url_list, data, format='json')
        # Locate confirm URL in email with HMAC value
        for line in mail.outbox[0].body.splitlines():
            if 'confirm-email' in line:
                confirm_url = line.split('testserver')[1].rsplit('/', 1)[0]
        queries = FuzzyInt(15, 20)
        with self.assertNumQueries(queries):
            res = self.client.post(confirm_url + '/')
        self.assertEqual(res.status_code, 302)
        self.assertTrue(
            self.user.emailaddress_set.filter(
                email=data['email'], verified=True
            ).exists(),
            'New email should be confirmed',
        )
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, data['email'])
        self.assertEqual(
            self.user.emailaddress_set.count(),
            1,
            'Expect only 1 email after confirm',
        )


@ddt
class EmailUpdateRestrictionTestCase(APITestCase):
    """
    Test that only organization owners and admins can update their email.
    """
    def setUp(self):
        self.owner = baker.make(settings.AUTH_USER_MODEL)
        self.admin = baker.make(settings.AUTH_USER_MODEL)
        self.member = baker.make(settings.AUTH_USER_MODEL)
        self.non_mmo_user = baker.make(settings.AUTH_USER_MODEL)

        self.organization = self.owner.organization
        self.organization.mmo_override = True
        self.organization.save(update_fields=['mmo_override'])

        self.organization.add_user(self.admin, is_admin=True)
        self.organization.add_user(self.member)

        clear_email_change_throttle(
            self.owner, self.admin, self.member, self.non_mmo_user
        )
        self.url_list = reverse('emailaddress-list')

    def test_that_mmo_owner_can_update_email(self):
        """
        Test that the owner of the organization can update their email
        """
        data = {'email': 'owner@example.com'}
        self.client.force_login(self.owner)
        record_authentication(self.client)
        res = self.client.post(self.url_list, data, format='json')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            self.owner.emailaddress_set.filter(email=data['email']).count(), 1
        )

    def test_that_mmo_admin_can_update_email(self):
        """
        Test that the admin of the organization can update their email
        """
        data = {'email': 'admin@example.com'}
        self.client.force_login(self.admin)
        record_authentication(self.client)
        res = self.client.post(self.url_list, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            self.admin.emailaddress_set.filter(email=data['email']).count(), 1
        )

    def test_that_mmo_member_cannot_update_email(self):
        """
        Test that the member of the organization cannot update their email
        """
        data = {'email': 'member@example.com'}
        self.client.force_login(self.member)
        record_authentication(self.client)
        res = self.client.post(self.url_list, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            self.member.emailaddress_set.filter(email=data['email']).count(), 0
        )

    def test_that_non_mmo_user_can_update_email(self):
        """
        Test that a user who is not part of MMO can update their email
        """
        data = {'email': 'nonmmo@example.com'}
        self.client.force_login(self.non_mmo_user)
        record_authentication(self.client)
        res = self.client.post(self.url_list, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            self.non_mmo_user.emailaddress_set.filter(
                email=data['email']
            ).count(),
            1
        )

    @data('mmo_admin', 'mmo_owner', 'mmo_member', 'non_mmo_user')
    def test_that_user_cannot_update_email_if_sso(self, user_type):
        if user_type == 'mmo_admin':
            user = self.admin
        elif user_type == 'mmo_owner':
            user = self.owner
        elif user_type == 'mmo_member':
            user = self.member
        else:
            user = self.non_mmo_user
        baker.make('socialaccount.SocialAccount', user=user)
        # in real life connecting the social account would have made an EmailAddress
        email_address = baker.make('account.emailaddress', user=user)
        self.assertNotEqual(email_address.email, 'new@example.com')
        self.client.force_login(user)
        record_authentication(self.client)
        data = {'email': 'new@example.com'}
        res = self.client.post(self.url_list, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        # just check that the EmailAddress objects haven't changed;
        # user.email relies on signal handlers so is tested in test_signals
        self.assertEqual(user.emailaddress_set.count(), 1)
        user_email = EmailAddress.objects.get(user=user)
        self.assertEqual(user_email.email, email_address.email)
        self.assertEqual(user.emailaddress_set.count(), 1)


@override_settings(ACCOUNT_RATE_LIMITS=False)
class EmailChangeReauthenticationTestCase(APITestCase):
    """
    Changing the email address requires a recent re-authentication: the
    password, plus MFA when the account has it enabled
    """

    def setUp(self):
        self.user = baker.make(settings.AUTH_USER_MODEL, username='reauth_user')
        self.user.set_password('secret')
        self.user.save()
        baker.make(
            'account.emailaddress',
            user=self.user,
            email='old@example.com',
            primary=True,
            verified=True,
        )
        self.client.force_login(self.user)
        clear_email_change_throttle(self.user)
        self.url_list = reverse('emailaddress-list')
        self.payload = {'email': 'new@example.com'}

    def test_no_authentication_record_is_rejected(self):
        res = self._post()
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert res.json()['code'] == 'reauthentication_required'
        assert self._pending_emails() == 0
        assert len(mail.outbox) == 0

    def test_fresh_password_is_accepted(self):
        record_authentication(self.client)
        res = self._post()
        assert res.status_code == status.HTTP_201_CREATED
        assert self._pending_emails() == 1

    def test_stale_password_is_rejected(self):
        record_authentication(self.client, age=301)
        res = self._post()
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert self._pending_emails() == 0

    @override_settings(ACCOUNT_REAUTHENTICATION_TIMEOUT=3600)
    def test_timeout_setting_is_honoured(self):
        record_authentication(self.client, age=301)
        res = self._post()
        assert res.status_code == status.HTTP_201_CREATED

    def test_response_lists_available_flows(self):
        res = self._post()
        assert res.json()['flows'] == [{'id': 'reauthenticate'}]

    def test_mfa_user_needs_both_password_and_mfa(self):
        with patch(
            'kobo.apps.accounts.reauthentication.is_mfa_enabled', return_value=True
        ):
            record_authentication(self.client, methods=('password',))
            res = self._post()
            assert (
                res.status_code == status.HTTP_403_FORBIDDEN
            ), 'password alone must not satisfy an MFA-enabled account'
            assert self._pending_emails() == 0

            record_authentication(self.client, methods=('password', 'mfa'))
            res = self._post()
            assert res.status_code == status.HTTP_201_CREATED
            assert self._pending_emails() == 1

    def test_mfa_user_with_stale_mfa_is_rejected(self):
        with patch(
            'kobo.apps.accounts.reauthentication.is_mfa_enabled', return_value=True
        ):
            record_authentication(self.client, methods=('password', 'mfa'), age=301)
            res = self._post()
            assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_sso_only_user_is_not_locked_out(self):
        """
        An account with no usable password and no MFA has no way to
        re-authenticate; blocking it would lock the user out permanently
        """
        self.user.set_unusable_password()
        self.user.save()
        res = self._post()
        assert res.status_code != status.HTTP_403_FORBIDDEN

    def test_delete_is_not_gated(self):
        """
        Discarding an unverified pending address cannot take an account over,
        so it does not require re-authentication.
        """
        baker.make(
            'account.emailaddress',
            user=self.user,
            email='pending@example.com',
            primary=False,
            verified=False,
        )
        res = self.client.delete(self.url_list)
        assert res.status_code == status.HTTP_204_NO_CONTENT
        assert self._pending_emails() == 0

    def test_token_auth_without_password_is_rejected(self):
        """
        A stateless credential has no session to re-authenticate in, so it
        proves itself in-band with the current password instead
        """
        self._use_token_auth()
        res = self._post()
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert 'current_password' in res.json()
        assert self._pending_emails() == 0

    def test_token_auth_with_wrong_password_is_rejected(self):
        self._use_token_auth()
        res = self._post_with(current_password='not-my-password')
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert 'current_password' in res.json()
        assert self._pending_emails() == 0

    def test_token_auth_with_correct_password_succeeds(self):
        self._use_token_auth()
        res = self._post_with(current_password='secret')
        assert res.status_code == status.HTTP_201_CREATED
        assert self._pending_emails() == 1

    def test_basic_auth_with_correct_password_succeeds(self):
        self.client.logout()
        credentials = base64.b64encode(b'reauth_user:secret').decode()
        self.client.credentials(HTTP_AUTHORIZATION=f'Basic {credentials}')
        res = self._post_with(current_password='secret')
        assert res.status_code == status.HTTP_201_CREATED

    def test_mfa_account_must_also_send_a_code(self):
        self._use_token_auth()
        with patch(
            'kobo.apps.accounts.reauthentication.is_mfa_enabled', return_value=True
        ):
            res = self._post_with(current_password='secret')
            assert res.status_code == status.HTTP_400_BAD_REQUEST
            assert 'mfa_code' in res.json()
            assert self._pending_emails() == 0

    def test_mfa_account_with_valid_code_succeeds(self):
        self._use_token_auth()
        with (
            patch(
                'kobo.apps.accounts.reauthentication.is_mfa_enabled',
                return_value=True,
            ),
            patch(
                'kobo.apps.accounts.reauthentication._is_valid_mfa_code',
                return_value=True,
            ),
        ):
            res = self._post_with(current_password='secret', mfa_code='123456')
            assert res.status_code == status.HTTP_201_CREATED
            assert self._pending_emails() == 1

    def test_mfa_account_with_invalid_code_is_rejected(self):
        self._use_token_auth()
        with (
            patch(
                'kobo.apps.accounts.reauthentication.is_mfa_enabled',
                return_value=True,
            ),
            patch(
                'kobo.apps.accounts.reauthentication._is_valid_mfa_code',
                return_value=False,
            ),
        ):
            res = self._post_with(current_password='secret', mfa_code='000000')
            assert res.status_code == status.HTTP_400_BAD_REQUEST
            assert 'mfa_code' in res.json()

    def test_sso_only_account_needs_no_proof(self):
        """
        Nothing to prove: no usable password and no MFA, matching the session
        path, which also lets such accounts through
        """
        self.user.set_unusable_password()
        self.user.save()
        self._use_token_auth()
        res = self._post()
        assert res.status_code != status.HTTP_400_BAD_REQUEST

    def test_email_change_is_throttled(self):
        """
        `current_password` would otherwise be an unthrottled guessing oracle:
        `ACCOUNT_RATE_LIMITS` is off and DRF sets no global default

        The configured rate is patched rather than exercised, so the test does
        not have to issue a hundred requests to prove the wiring works.
        """
        self._use_token_auth()
        with patch.object(
            ScopedRateThrottle, 'THROTTLE_RATES', {'email_change': '3/hour'}
        ):
            codes = [
                self._post_with(current_password='wrong').status_code for _ in range(5)
            ]
        assert codes[:3] == [status.HTTP_400_BAD_REQUEST] * 3, codes
        assert codes[3:] == [status.HTTP_429_TOO_MANY_REQUESTS] * 2, codes

    def test_invalid_password_or_email_does_not_burn_code(self):
        """
        A recovery code may only be spent once, so it must not be consumed on a
        request that was going to fail anyway due to a wrong password or an email
        that cannot be set
        """
        self._use_token_auth()
        with (
            patch(
                'kobo.apps.accounts.reauthentication.is_mfa_enabled',
                return_value=True,
            ),
            patch('kobo.apps.accounts.reauthentication._is_valid_mfa_code') as validate,
        ):
            res = self._post_with(current_password='wrong', mfa_code='123456')
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        validate.assert_not_called()

    def _use_token_auth(self):
        self.client.logout()
        token, _ = Token.objects.get_or_create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def _pending_emails(self):
        return self.user.emailaddress_set.filter(verified=False).count()

    def _post(self):
        return self.client.post(self.url_list, self.payload, format='json')

    def _post_with(self, **extra):
        return self.client.post(self.url_list, {**self.payload, **extra}, format='json')
