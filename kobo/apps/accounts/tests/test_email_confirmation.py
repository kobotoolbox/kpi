from unittest.mock import patch

from constance.test import override_config
from django.conf import settings
from django.core import mail
from django.core.cache import cache
from django.urls import reverse
from model_bakery import baker
from rest_framework import status
from rest_framework.test import APITestCase

from kobo.apps.accounts.constants import EMAIL_CONFIRMATION_REQUESTED_DETAIL


def make_user(username, email, verified, is_active=True):
    user = baker.make(settings.AUTH_USER_MODEL, username=username, is_active=is_active)
    baker.make(
        'account.emailaddress',
        user=user,
        email=email,
        primary=True,
        verified=verified,
    )
    return user


@override_config(EMAIL_CONFIRMATION_REQUESTS_PER_HOUR=0)
class EmailConfirmationRequestTestCase(APITestCase):
    """
    `POST /api/v2/email-confirmations/` sends a fresh confirmation link to a
    registered, unverified address, and says nothing about any other address
    """

    def setUp(self):
        self.url = reverse('api_v2:email-confirmation')

    def post(self, email):
        return self.client.post(self.url, {'email': email}, format='json')

    def assertGenericSuccess(self, response):
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == {'detail': str(EMAIL_CONFIRMATION_REQUESTED_DETAIL)}

    def test_unverified_address_gets_a_confirmation_email(self):
        make_user('pending', 'pending@example.com', verified=False)
        response = self.post('pending@example.com')
        self.assertGenericSuccess(response)
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ['pending@example.com']

    def test_verified_address_gets_no_email(self):
        """
        Already-verified accounts have nothing to confirm; mailing them would
        turn the endpoint into a way to spam a known-good inbox
        """
        make_user('active', 'active@example.com', verified=True)
        response = self.post('active@example.com')
        self.assertGenericSuccess(response)
        assert len(mail.outbox) == 0

    def test_unknown_address_gets_no_email(self):
        response = self.post('nobody@example.com')
        self.assertGenericSuccess(response)
        assert len(mail.outbox) == 0

    def test_all_three_outcomes_are_indistinguishable(self):
        """
        The whole point of the endpoint: registered, verified and unknown must
        be impossible to tell apart from the response
        """
        make_user('pending', 'pending@example.com', verified=False)
        make_user('active', 'active@example.com', verified=True)

        responses = [
            self.post('pending@example.com'),
            self.post('active@example.com'),
            self.post('nobody@example.com'),
        ]
        statuses = {r.status_code for r in responses}
        bodies = {r.content for r in responses}
        assert statuses == {status.HTTP_200_OK}
        assert len(bodies) == 1, 'response bodies must not vary by outcome'

    def test_address_is_matched_case_insensitively(self):
        """
        The submitted address is normalized before lookup, the way allauth
        normalizes on write, so a user typing their address with different
        capitalisation still gets their link
        """
        make_user('pending', 'pending@example.com', verified=False)
        self.assertGenericSuccess(self.post('Pending@Example.COM'))
        assert len(mail.outbox) == 1

    def test_inactive_user_gets_no_email(self):
        """
        Deleted and suspended accounts are deactivated; they must not be
        reachable through here
        """
        make_user('gone', 'gone@example.com', verified=False, is_active=False)
        self.assertGenericSuccess(self.post('gone@example.com'))
        assert len(mail.outbox) == 0

    def test_pending_email_change_gets_a_confirmation_email(self):
        """
        A verified account with an unverified secondary address is mid email
        change (see `POST /api/v2/me/emails/`) and is waiting on the same link
        """
        user = make_user('changer', 'old@example.com', verified=True)
        baker.make(
            'account.emailaddress',
            user=user,
            email='new@example.com',
            primary=False,
            verified=False,
        )
        self.assertGenericSuccess(self.post('new@example.com'))
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ['new@example.com']

    def test_shared_address_mails_every_unverified_account(self):
        """
        `ACCOUNT_UNIQUE_EMAIL` is `False`, so the same address may belong to
        several accounts, each with its own link to send
        """
        make_user('first', 'shared@example.com', verified=False)
        make_user('second', 'shared@example.com', verified=False)
        make_user('third', 'shared@example.com', verified=True)

        self.assertGenericSuccess(self.post('shared@example.com'))
        assert len(mail.outbox) == 2, 'the verified account must be skipped'

    def test_malformed_address_is_rejected(self):
        response = self.post('not-an-email')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'email' in response.json()
        assert len(mail.outbox) == 0

    def test_missing_email_is_rejected(self):
        response = self.client.post(self.url, {}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert len(mail.outbox) == 0

    def test_send_failure_does_not_leak_registration(self):
        """
        Mail is only ever attempted for a registered address, so a 5xx on
        failure would answer the question the endpoint refuses to answer
        """
        make_user('pending', 'pending@example.com', verified=False)
        with patch(
            'kobo.apps.accounts.views.send_verification_email_to_address',
            side_effect=OSError('smtp is down'),
        ):
            with self.assertLogs('console_logger', level='ERROR'):
                response = self.post('pending@example.com')
        self.assertGenericSuccess(response)

    def test_template_is_chosen_per_account_not_per_request(self):
        """
        One address can be both at once when it is shared: a never-activated
        account and another account's pending change. Each owner gets the email
        that matches their own situation
        """
        make_user('fresh', 'shared@example.com', verified=False)
        changer = make_user('changer', 'old@example.com', verified=True)
        baker.make(
            'account.emailaddress',
            user=changer,
            email='shared@example.com',
            primary=False,
            verified=False,
        )

        self.post('shared@example.com')
        assert len(mail.outbox) == 2
        assert {m.subject.strip() for m in mail.outbox} == {
            'Activate your KoboToolbox Account',
            'KoboToolbox account email address verification',
        }


@override_config(EMAIL_CONFIRMATION_REQUESTS_PER_HOUR=2)
class EmailConfirmationRequestThrottleTestCase(APITestCase):

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.url = reverse('api_v2:email-confirmation')

    def post(self, email, **extra):
        return self.client.post(self.url, {'email': email}, format='json', **extra)

    def test_per_address_limit_stops_mail_bombing(self):
        make_user('pending', 'pending@example.com', verified=False)

        # Each request comes from a different source address: the limit follows
        # the recipient, not the caller, so rotating source addresses buys nothing
        for index in range(2):
            response = self.post('pending@example.com', REMOTE_ADDR=f'10.0.0.{index}')
            assert response.status_code == status.HTTP_200_OK

        response = self.post('pending@example.com', REMOTE_ADDR='10.0.0.99')
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert len(mail.outbox) == 2

    def test_throttling_is_case_insensitive_per_address(self):
        """
        Otherwise flipping the case of a letter would buy a fresh bucket
        """
        make_user('pending', 'pending@example.com', verified=False)
        self.post('pending@example.com')
        self.post('PENDING@example.com')
        response = self.post('Pending@Example.com')
        assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS

    def test_other_addresses_keep_their_own_budget(self):
        """
        One address being throttled must not lock everyone else out: the limit
        is per recipient, so it cannot be used to deny the endpoint to others
        """
        make_user('pending', 'pending@example.com', verified=False)
        make_user('other', 'other@example.com', verified=False)

        for _ in range(2):
            assert self.post('pending@example.com').status_code == (status.HTTP_200_OK)
        assert self.post('pending@example.com').status_code == (
            status.HTTP_429_TOO_MANY_REQUESTS
        )

        assert self.post('other@example.com').status_code == status.HTTP_200_OK
