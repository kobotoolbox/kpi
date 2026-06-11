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

    def test_reconnect_sso_with_existing_email_does_not_raise(self):
        """
        Reconnecting SSO when the email already exists in EmailAddress must
        not raise IntegrityError on the unique(user_id, email) constraint.
        """
        request = RequestFactory().get('/')
        same_address = EmailAddress(
            email=self.user.email,
            verified=True,
            primary=True,
        )
        social_login = SocialLogin(email_addresses=[same_address], user=self.user)
        update_email(request=request, sociallogin=social_login)

        assert EmailAddress.objects.filter(user=self.user).count() == 1
        addr = EmailAddress.objects.get(user=self.user)
        assert addr.email == self.user.email
        assert addr.primary

    def test_reconnect_sso_does_not_affect_other_user_with_same_email(self):
        """
        When two users share an email address and one reconnects via SSO,
        the other user's EmailAddress must remain untouched.
        """
        shared_email = self.user.email
        other_user = User.objects.create_user(
            username='otheruser',
            email=shared_email,
            password='password',
        )
        other_address = EmailAddress.objects.create(
            user=other_user,
            email=shared_email,
            verified=True,
            primary=True,
        )

        request = RequestFactory().get('/')
        same_address = EmailAddress(
            email=shared_email,
            verified=True,
            primary=True,
        )
        social_login = SocialLogin(email_addresses=[same_address], user=self.user)
        update_email(request=request, sociallogin=social_login)

        self_addr = EmailAddress.objects.get(user=self.user)
        assert self_addr.primary
        assert self_addr.email == shared_email

        refreshed_other = EmailAddress.objects.get(pk=other_address.pk)
        assert refreshed_other.user == other_user
        assert refreshed_other.primary

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
