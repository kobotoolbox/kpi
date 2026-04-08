from constance.test import override_config
from django.test import TestCase

from hub.admin.extend_user import validate_superuser_auth
from kobo.apps.accounts.mfa.models import MfaMethodsWrapper
from kobo.apps.kobo_auth.shortcuts import User


@override_config(SUPERUSER_AUTH_ENFORCEMENT=True)
class ValidateSuperuserMfaTest(TestCase):

    def setUp(self):
        self.superuser = User.objects.create_superuser(
            username='admin', password='adminpassword'
        )

    def test_superuser_without_mfa_and_usable_password(self):
        self.assertFalse(validate_superuser_auth(self.superuser))

    def test_superuser_with_unusable_password(self):
        self.superuser.set_unusable_password()
        self.assertTrue(validate_superuser_auth(self.superuser))

    def test_superuser_with_mfa_enabled(self):
        MfaMethodsWrapper.objects.create(user=self.superuser, is_active=True)
        self.assertTrue(validate_superuser_auth(self.superuser))

    def test_regular_user_without_mfa(self):
        """
        Regular users should never be blocked by this setting
        """
        regular_user = User.objects.create_user(username='regular', password='password')
        self.assertTrue(validate_superuser_auth(regular_user))

    def test_superuser_with_inactive_mfa(self):
        """
        If the MFA record exists but is_active is False,
        it should still be considered invalid for a superuser.
        """
        MfaMethodsWrapper.objects.create(user=self.superuser, is_active=False)
        self.assertFalse(validate_superuser_auth(self.superuser))

    @override_config(SUPERUSER_AUTH_ENFORCEMENT=False)
    def test_superuser_with_enforcement_disabled(self):
        """
        If enforcement is OFF, the validator should return True even if
        the superuser has no MFA.
        """
        self.assertTrue(validate_superuser_auth(self.superuser))
