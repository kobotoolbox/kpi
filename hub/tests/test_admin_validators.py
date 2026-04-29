from constance.test import override_config
from django.core.exceptions import ValidationError
from django.test import TestCase

from hub.admin.extend_user import validate_superuser_auth
from kobo.apps.accounts.mfa.models import MfaMethodsWrapper
from kobo.apps.kobo_auth.shortcuts import User


@override_config(SUPERUSER_AUTH_ENFORCEMENT=True)
class ValidateSuperuserMfaTest(TestCase):

    def setUp(self):
        # Create a user who is NOT a superuser yet for promotion tests
        self.user = User.objects.create_user(
            username='staff_member', password='password123'
        )
        self.superuser = User.objects.create_superuser(
            username='admin', password='adminpassword'
        )

    def test_superuser_without_mfa_and_usable_password(self):
        self.assertFalse(validate_superuser_auth(self.superuser, True))

    def test_superuser_with_unusable_password(self):
        self.superuser.set_unusable_password()
        self.assertTrue(validate_superuser_auth(self.superuser, False))

    def test_superuser_with_mfa_enabled(self):
        MfaMethodsWrapper.objects.create(user=self.superuser, is_active=True)
        self.assertTrue(validate_superuser_auth(self.superuser, True))

    def test_regular_user_without_mfa(self):
        """
        Regular users should never be blocked by this setting
        """
        regular_user = User.objects.create_user(username='regular', password='password')
        self.assertTrue(validate_superuser_auth(regular_user, False))

    def test_superuser_with_inactive_mfa(self):
        """
        If the MFA record exists but is_active is False,
        it should still be considered invalid for a superuser.
        """
        MfaMethodsWrapper.objects.create(user=self.superuser, is_active=False)
        self.assertFalse(validate_superuser_auth(self.superuser, True))

    @override_config(SUPERUSER_AUTH_ENFORCEMENT=False)
    def test_superuser_with_enforcement_disabled(self):
        """
        If enforcement is OFF, the validator should return True even if
        the superuser has no MFA.
        """
        self.assertTrue(validate_superuser_auth(self.superuser, True))

    def test_block_mfa_deletion_for_superuser(self):
        """
        Ensure a superuser's MFA methods cannot be deleted when enforcement is on
        """
        mfa_method = MfaMethodsWrapper.objects.create(
            user=self.superuser, is_active=True
        )

        with self.assertRaises(ValidationError):
            mfa_method.delete()

        active_mfa_count = MfaMethodsWrapper.objects.filter(
            user=self.superuser, is_active=True
        ).count()
        self.assertEqual(active_mfa_count, 1, 'MFA record should still exist')

    def test_promotion_to_superuser_without_mfa_fails(self):
        """
        Promoting a user to superuser should fail if they don't have MFA
        """
        self.assertFalse(self.user.is_superuser)
        is_superuser_requested = True

        result = validate_superuser_auth(self.user, is_superuser_requested)
        self.assertFalse(
            result, 'Should block promotion to superuser if MFA is missing'
        )
