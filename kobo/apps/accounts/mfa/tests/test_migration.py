from allauth.account.models import EmailAddress
from allauth.mfa.adapter import get_adapter
from django.conf import settings
from django.urls import reverse
from rest_framework import status
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
        mfa_trench = get_mfa_model().objects.create(
            user=self.someuser,
            secret='CPALQQLP4JVV6HZOCPKVARERTFRUULN5',
            name='app',
            is_primary=True,
            is_active=True,
        )
        mfa_trench.backup_codes = ['abcdefg', '123456']
        mfa_trench.save()

        adapter = get_adapter()
        adapter.migrate_user(self.someuser)

        data = {
            'login': 'someuser',
            'password': 'someuser',
        }
        response = self.client.post(reverse('kobo_login'), data=data, follow=True)
        self.assertRedirects(response, reverse('mfa_authenticate'))

        code = get_mfa_code_for_user(self.someuser)
        response = self.client.post(
            reverse('mfa_authenticate'), {'code': 'asdfasdfasdf'}
        )
        assert response.status_code == status.HTTP_200_OK
        assert reverse('mfa_authenticate') == response.request['PATH_INFO']

        code = get_mfa_code_for_user(self.someuser)
        response = self.client.post(reverse('mfa_authenticate'), {'code': code})
        breakpoint()
        assert response.status_code == status.HTTP_200_OK
        assert reverse(settings.LOGIN_REDIRECT_URL) == response.request['PATH_INFO']
