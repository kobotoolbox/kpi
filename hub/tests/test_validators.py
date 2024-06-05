from constance import config
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase
from hub.admin.validators import validate_superuser_auth
from kobo.apps.accounts.mfa.models import MfaMethod


class ValidateSuperuserMfaTest(TestCase):

    def setUp(self):
        self.superuser = User.objects.create_superuser(
            username='admin', password='adminpassword'
        )

    def test_superuser_without_mfa_and_usable_password(self):
        with self.assertRaises(ValidationError):
            validate_superuser_auth(self.superuser)

    def test_superuser_with_unusable_password(self):
        self.superuser.set_unusable_password()
        try:
            validate_superuser_auth(self.superuser)
        except ValidationError:
            self.fail(
                "validate_superuser_mfa() raised ValidationError unexpectedly!"
            )

    def test_superuser_with_mfa_enabled(self):
        MfaMethod.objects.create(user=self.superuser, is_active=True)
        try:
            validate_superuser_auth(self.superuser)
        except ValidationError:
            self.fail(
                "validate_superuser_mfa() raised ValidationError unexpectedly!"
            )
