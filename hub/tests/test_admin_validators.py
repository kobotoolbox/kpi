from constance import config
from django.contrib.auth.models import User
from django.test import TestCase
from hub.admin.extend_user import validate_superuser_auth
from kobo.apps.accounts.mfa.models import MfaMethod


class ValidateSuperuserMfaTest(TestCase):

    def setUp(self):
        config.SUPERUSER_AUTH_ENFORCEMENT = True
        self.superuser = User.objects.create_superuser(
            username='admin', password='adminpassword'
        )

    def test_superuser_without_mfa_and_usable_password(self):
        self.assertFalse(validate_superuser_auth(self.superuser))

    def test_superuser_with_unusable_password(self):
        self.superuser.set_unusable_password()
        self.assertTrue(validate_superuser_auth(self.superuser))

    def test_superuser_with_mfa_enabled(self):
        MfaMethod.objects.create(user=self.superuser, is_active=True)
        self.assertTrue(validate_superuser_auth(self.superuser))
