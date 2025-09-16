from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialLogin
from django.test import RequestFactory, TestCase

from kobo.apps.accounts.signals import update_email
from kobo.apps.kobo_auth.shortcuts import User


class TestAccountSignals(TestCase):
    fixtures = ['test_data']
    def setUp(self):
        self.user = User.objects.get(username='someuser')
        self.email_address = EmailAddress.objects.create(
            user=self.user,
            email=self.user.email,
            verified=True,
            primary=True
        )

    def test_social_login_connect_updates_primary_email(self):
        request = RequestFactory().get('/')
        new_address = EmailAddress(
            email='someuser_sso@example.com',
            verified=True,
            primary=True
        )
        social_login = SocialLogin(email_addresses=[new_address], user=self.user)
        update_email(request=request, sociallogin=social_login)
        # we should have gotten rid of any old EmailAddresses
        assert EmailAddress.objects.count() == 1
        found_address = EmailAddress.objects.first()
        assert found_address.email == new_address.email
        assert found_address.verified
        assert found_address.primary
        assert self.user.email == new_address.email
