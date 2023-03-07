from django.test import TestCase, override_settings
from model_bakery import baker
from pyquery import PyQuery
from kobo.apps.accounts.forms import SocialSignupForm


class AccountFormsTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = baker.make('auth.User')
        cls.sociallogin = baker.make(
            "socialaccount.SocialAccount", user=cls.user
        )

    @override_settings(UNSAFE_SSO_REGISTRATION_EMAIL_DISABLE=True)
    def test_social_signup_form_not_email_disabled(self):
        form = SocialSignupForm(sociallogin=self.sociallogin)
        pq = PyQuery(str(form))
        assert (email_input := pq("[name=email]"))
        assert "readonly" in email_input[0].attrib

    @override_settings(UNSAFE_SSO_REGISTRATION_EMAIL_DISABLE=False)
    def test_social_signup_form_not_email_not_disabled(self):
        form = SocialSignupForm(sociallogin=self.sociallogin)
        pq = PyQuery(str(form))
        assert (email_input := pq("[name=email]"))
        assert "readonly" not in email_input[0].attrib
