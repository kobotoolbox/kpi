from allauth.account.models import EmailAddress
from allauth.mfa.adapter import get_adapter
from django.conf import settings
from django.urls import reverse
from rest_framework import status
from trench.command.replace_mfa_method_backup_codes import (
    regenerate_backup_codes_for_mfa_method_command,
)
from trench.utils import get_mfa_model

from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.kpi_test_case import BaseTestCase
from .utils import get_mfa_code_for_user


class MfaMigrationTestCase(BaseTestCase):
    """
    Test the migration scripts
    """

    fixtures = ['test_data']

    def setUp(self):
        self.someuser = User.objects.get(username='someuser')
        # Confirm someuser's e-mail address as primary and verified
        email_address, _ = EmailAddress.objects.get_or_create(user=self.someuser)
        email_address.primary = True
        email_address.verified = True
        email_address.save()

    def test_migrate_trench_data(self):
        # Activate Trench MFA for someuser
        get_mfa_model().objects.create(
            user=self.someuser,
            secret='CPALQQLP4JVV6HZOCPKVARERTFRUULN5',
            name='app',
            is_primary=True,
            is_active=True,
        )
        backup_codes = list(
            regenerate_backup_codes_for_mfa_method_command(self.someuser.id, 'app')
        )

        # Migrate to allauth MFA
        adapter = get_adapter()
        adapter.migrate_user(self.someuser)
        login_data = {
            'login': 'someuser',
            'password': 'someuser',
        }

        # Test multiple cases
        valid_code = get_mfa_code_for_user(self.someuser)
        for code, should_pass_through in [
            (valid_code, True),  # TOTP code
            (backup_codes[0], True),  # Backup
            (backup_codes[0], False),  # Expired code
            (backup_codes[1], True),
            (backup_codes[1], False),
            (backup_codes[2], True),
            ('000111', False),  # Invalid code
            ('111111', False),  # Invalid code
        ]:
            self.client.post(reverse('kobo_login'), data=login_data)
            response = self.client.post(reverse('mfa_authenticate'), {'code': code})
            if should_pass_through:
                self.assertRedirects(response, reverse(settings.LOGIN_REDIRECT_URL))
            else:
                assert response.status_code == status.HTTP_200_OK
                assert 'Incorrect code' in response.content.decode()
            self.client.logout()
