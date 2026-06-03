import os
from io import StringIO
from unittest.mock import MagicMock, patch

import pytest
from django.core.management import call_command
from django.db.utils import ProgrammingError
from django.test import TestCase

from allauth.account.models import EmailAddress
from kobo.apps.kobo_auth.shortcuts import User


MODULE = 'kpi.management.commands.create_kobo_superuser'


class CreateKoboSuperuserCommandTest(TestCase):

    USERNAME = 'kobo_superuser_test'
    EMAIL = 'kobo_test@example.com'
    PASSWORD = 'kobo_test_pass'

    def _env(self):
        return {
            'KOBO_SUPERUSER_USERNAME': self.USERNAME,
            'KOBO_SUPERUSER_EMAIL': self.EMAIL,
            'KOBO_SUPERUSER_PASSWORD': self.PASSWORD,
        }

    @patch(f'{MODULE}.UserProfile')
    def test_creates_superuser_successfully(self, mock_userprofile):
        """
        Superuser, EmailAddress, and UserProfile are all created when none
        exist.
        """
        mock_userprofile.objects.get_or_create.return_value = (MagicMock(), True)
        out = StringIO()

        with patch.dict(os.environ, self._env()):
            call_command('create_kobo_superuser', stdout=out)

        user = User.objects.get(username=self.USERNAME)
        assert user.is_superuser
        assert EmailAddress.objects.filter(
            user=user, email=self.EMAIL, verified=True, primary=True
        ).exists()
        mock_userprofile.objects.get_or_create.assert_called_once_with(
            user_id=user.pk,
            defaults={'validated_password': True},
        )
        assert f'Superuser `{self.USERNAME}` successfully created.' in out.getvalue()

    @patch(f'{MODULE}.UserProfile')
    @patch(f'{MODULE}.EmailAddress')
    @patch(f'{MODULE}.User')
    def test_programming_error_recovers_and_skips_profile(
        self, mock_user_cls, mock_email_cls, mock_userprofile_cls
    ):
        """
        When the KC database raises ProgrammingError during superuser creation
        (signal-level failure), the user is retrieved from the KPI DB,
        EmailAddress is still created, and UserProfile is skipped.
        """
        mock_user = MagicMock()
        mock_user.email = self.EMAIL
        mock_user.pk = 999

        mock_user_cls.objects.filter.return_value.exists.return_value = False
        mock_user_cls.objects.create_superuser.side_effect = ProgrammingError
        mock_user_cls.objects.get.return_value = mock_user
        mock_email_cls.objects.get_or_create.return_value = (MagicMock(), True)

        out = StringIO()
        with patch.dict(os.environ, self._env()):
            call_command('create_kobo_superuser', stdout=out)

        mock_user_cls.objects.get.assert_called_once_with(username=self.USERNAME)
        mock_email_cls.objects.get_or_create.assert_called_once_with(
            user=mock_user,
            email=mock_user.email,
            defaults={'verified': True, 'primary': True},
        )
        mock_userprofile_cls.objects.get_or_create.assert_not_called()
        assert 'not synced to KC database' in out.getvalue()

    def test_exits_if_user_already_exists(self):
        """
        Command exits cleanly when the superuser already exists, without
        creating a duplicate.
        """
        User.objects.create_superuser(self.USERNAME, self.EMAIL, self.PASSWORD)
        out = StringIO()

        with patch.dict(os.environ, self._env()):
            with pytest.raises(SystemExit):
                call_command('create_kobo_superuser', stdout=out)

        assert User.objects.filter(username=self.USERNAME).count() == 1
        assert 'User already exists.' in out.getvalue()
