from allauth.account.models import EmailAddress
from allauth.mfa.adapter import get_adapter
from ddt import data, ddt, unpack
from django.conf import settings
from django.test import override_settings
from django.urls import reverse
from freezegun import freeze_time
from rest_framework import status
from trench.command.replace_mfa_method_backup_codes import (
    regenerate_backup_codes_for_mfa_method_command,
)
from trench.utils import get_mfa_model

from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.kpi_test_case import BaseTestCase
from .utils import get_mfa_code_for_user


@ddt
@override_settings(ACCOUNT_RATE_LIMITS=False)
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
        # Activate Trench MFA for someuser
        get_mfa_model().objects.create(
            user=self.someuser,
            secret='CPALQQLP4JVV6HZOCPKVARERTFRUULN5',
            name='app',
            is_primary=True,
            is_active=True,
        )
        self.backup_codes = list(
            regenerate_backup_codes_for_mfa_method_command(self.someuser.id, 'app')
        )
        # Migrate to allauth MFA
        adapter = get_adapter()
        adapter.migrate_user(self.someuser)
        self.login_data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        # Simulate expired backup code
        self.client.post(reverse('kobo_login'), data=self.login_data)
        self.client.post(reverse('mfa_authenticate'), {'code': self.backup_codes[0]})
        self.client.logout()

    @freeze_time('2026-01-01 12:00:00')
    @data(
        ('TOTP', None, True),  # TOTP code
        ('BACKUP', 0, False),  # Expired backup code
        ('BACKUP', 1, True),  # Usable backup code
        ('CODE', '000111', False),  # Invalid code
        ('CODE', '111111', False),  # Invalid code
    )
    @unpack
    def test_migrate_trench_data(self, code_type, code_data, should_pass_through):
        # Get the code
        if code_type == 'TOTP':
            code = get_mfa_code_for_user(self.someuser)
        elif code_type == 'BACKUP':
            code = self.backup_codes[code_data]
        elif code_type == 'CODE':
            code = code_data
        else:
            raise ValueError('Invalid code type')

        response = self.client.post(reverse('kobo_login'), data=self.login_data)
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse('mfa_authenticate'), response.url)

        response = self.client.post(reverse('mfa_authenticate'), {'code': code})
        if should_pass_through:
            self.assertRedirects(response, reverse(settings.LOGIN_REDIRECT_URL))
        else:
            assert response.status_code == status.HTTP_200_OK
            assert 'Incorrect code' in response.content.decode()
        self.client.logout()
