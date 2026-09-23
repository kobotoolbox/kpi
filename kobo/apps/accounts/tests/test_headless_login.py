from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import Client, TestCase
from django.urls import reverse

from hub.models.sitewide_message import SitewideMessage

HEADLESS_LOGIN_URL = '/api/v2/allauth/browser/v1/auth/login'
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
