from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialApp
from allauth.socialaccount.providers.openid_connect.provider import (
    OpenIDConnectProvider,
)
from django.core import mail
from django.test import override_settings
from django.urls import reverse
from model_bakery import baker
from rest_framework.test import APITestCase


class AccountsEmailTestCase(APITestCase):
    def setUp(self):
        self.user = baker.make('auth.User')
        self.client.force_login(self.user)
        self.url_list = reverse('socialaccount-list')

    def test_list(self):
        account1 = baker.make('socialaccount.SocialAccount', user=self.user)
        account2 = baker.make('socialaccount.SocialAccount')
        # Auth, Count, Queryset
        with self.assertNumQueries(3):
            res = self.client.get(self.url_list)
        self.assertContains(res, account1.uid)
        self.assertNotContains(res, account2.uid)

    def test_delete(self):
        account = baker.make('socialaccount.SocialAccount', user=self.user)
        url = reverse(
            'socialaccount-detail',
            kwargs={'pk': f'{account.provider}/{account.uid}'},
        )
        res = self.client.delete(url)
        self.assertEqual(res.status_code, 204)
        self.assertFalse(self.user.socialaccount_set.exists())


@override_settings(
    SOCIALACCOUNT_PROVIDERS={
        "openid_connect": {
            "SERVERS": [
                {
                    "id": "example",
                    "server_url": "https://example.org/oauth",
                    "name": "Example",
                }
            ]
        }
    }
)
class ProviderTestCase(APITestCase):
    def setUp(self):
        self.application = SocialApp.objects.create(
            provider="Example",
            name="Example",
            client_id="vW1RcAl7Mb0d5gyHNQIAcH110lWoOW2BmWJIero8",
            secret="DZFpuNjRdt5xUEzxXovAp40bU3lQvoMvF3awEStn61RXWE0Ses"
            "4RgzHWKJKTvUCHfRkhcBi3ebsEfSjfEO96vo2Sh6pZlxJ6f7KcUbhvqMMPoVxRw"
            "v4vfdWEoWMGPeIO",
        )

        self.request = None  # request required but seems not to be used
        self.provider = OpenIDConnectProvider(self.request)

    def tearDown(self):
        self.application.delete()

    def test_user_signup_email_populated(self):
        payload = {
            "sub": "60e1123a-3583-4f04-a0ef-1037e97c2276",  # random uuid4
            "email": "test@example.org",
            "given_name": "Test",
            "family_name": "User",
        }

        sociallogin = self.provider.sociallogin_from_response(
            request=self.request, response=payload
        )
        assert sociallogin.user.email == "test@example.org"

    def test_user_signup_email_not_populated_if_not_provided(self):
        payload = {"sub": "60e1123a-3583-4f04-a0ef-1037e97c2276"}
        sociallogin = self.provider.sociallogin_from_response(
            request=self.request, response=payload
        )
        assert sociallogin.user.email == ""
