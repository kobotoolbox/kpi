import contextlib
from datetime import datetime, timedelta
from unittest.mock import patch

from allauth.account.models import EmailAddress
from django.test import override_settings
from django.urls import resolve, reverse
from trench.utils import get_mfa_model

from kobo.apps.audit_log.models import AuditAction, AuditLog, SubmissionGroup
from kobo.apps.audit_log.signals import (
    GROUP_DELTA_MINUTES,
    add_submission_to_group,
    create_access_log,
)
from kobo.apps.audit_log.tests.test_utils import (
    create_access_log_from_user_with_metadata,
    create_submission_access_log,
    create_submission_group_log,
    skip_login_access_log,
)
from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import (
    SUBMISSION_ACCESS_LOG_AUTH_TYPE,
    SUBMISSION_GROUP_COUNT_KEY,
    SUBMISSION_GROUP_LATEST_KEY,
)
from kpi.tests.base_test_case import BaseTestCase


class AuditLogForLoginsTestCase(BaseTestCase):
    """
    Class for testing that logins produce AuditLogs.

    Here we just test that AuditLogs are produced, not necessarily what they contain. More tests for what they contain
    are in test_models.py. Also, AuditLogs for SSO logins are tested as part of the SSO tests
    to avoid copying lots of complicated setup.
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = User.objects.create_user('user', 'user@example.com', 'pass')
        cls.user.backend = 'django.contrib.auth.backends.ModelBackend'
        cls.user.save()

    @patch('kobo.apps.audit_log.signals.AuditLog.create_access_log_for_request')
    def test_audit_log_created_on_login(self, patched_create):
        """
        Basic plumbing test to make sure the signal is hooked up
        """
        self.client.login(username='user', password='pass')
        patched_create.assert_called_once()

    @override_settings(ACCOUNT_EMAIL_VERIFICATION='none')
    def test_simple_login(self):
        count = AuditLog.objects.count()
        self.assertEqual(count, 0)
        user = AuditLogForLoginsTestCase.user
        data = {
            'login': 'user',
            'password': 'pass',
        }
        response = self.client.post(
            reverse('kobo_login'), data=data, follow=True
        )
        audit_log = AuditLog.objects.first()
        # AuditLogs are tested more fully elsewhere, just make sure one was created
        self.assertEqual(audit_log.user.id, user.id)
        self.assertEqual(audit_log.action, AuditAction.AUTH)

    def test_login_with_email_verification(self):
        user = AuditLogForLoginsTestCase.user
        data = {
            'login': 'user',
            'password': 'pass',
        }
        self.client.post(reverse('kobo_login'), data=data, follow=True)
        # no audit log should be created yet because the email has not been verified
        self.assertEquals(AuditLog.objects.count(), 0)
        # verify the email and try again
        email: EmailAddress = EmailAddress.objects.filter(user=user).first()
        email.verified = True
        email.save()
        self.client.post(reverse('kobo_login'), data=data, follow=True)
        audit_log = AuditLog.objects.first()
        self.assertEqual(audit_log.user.id, user.id)
        self.assertEqual(audit_log.action, AuditAction.AUTH)

    def test_mfa_login(self):
        mfa_object = get_mfa_model().objects.create(
            user=AuditLogForLoginsTestCase.user,
            secret='dummy_mfa_secret',
            name='app',
            is_primary=True,
            is_active=True,
            _backup_codes='dummy_encoded_codes',
        )
        mfa_object.save()
        email_address, _ = EmailAddress.objects.get_or_create(
            user=AuditLogForLoginsTestCase.user
        )
        email_address.primary = True
        email_address.verified = True
        email_address.save()
        data = {
            'login': 'user',
            'password': 'pass',
        }
        self.client.post(reverse('kobo_login'), data=data, follow=True)
        # no audit log should be created yet because the MFA code hasn't been entered
        self.assertEqual(AuditLog.objects.count(), 0)

        with patch(
            'kobo.apps.accounts.mfa.forms.authenticate_second_step_command',
            return_value=AuditLogForLoginsTestCase.user,
        ):
            self.client.post(
                reverse('mfa_token'),
                data={'code': '123456', 'ephemeral_token': 'dummy'},
                follow=True,
            )
        self.assertEqual(AuditLog.objects.count(), 1)
        audit_log = AuditLog.objects.first()
        self.assertEqual(audit_log.user.id, AuditLogForLoginsTestCase.user.id)
        self.assertEqual(audit_log.action, AuditAction.AUTH)

    def test_loginas(self):
        AuditLogForLoginsTestCase.user.is_superuser = True
        AuditLogForLoginsTestCase.user.save()
        new_user = User.objects.create_user(
            'user2', 'user2@example.com', 'pass2'
        )
        new_user.save()
        with skip_login_access_log():
            self.client.login(username='user', password='pass')
        self.client.post(reverse('loginas-user-login', args=[new_user.id]))
        self.assertEqual(AuditLog.objects.count(), 1)
        audit_log = AuditLog.objects.first()
        self.assertEqual(audit_log.user.id, new_user.id)
        self.assertEqual(audit_log.action, AuditAction.AUTH)


class AuditLogSubmissionGroupTestCase(BaseTestCase):

    fixtures = ['test_data']

    def test_create_group_for_new_submission(self):
        someuser = User.objects.get(username='someuser')
        submission_log = create_submission_access_log(someuser)
        submission_log.save()
        new_group = (
            SubmissionGroup.objects.filter(user=someuser)
            .order_by(f'-metadata__{SUBMISSION_GROUP_LATEST_KEY}')
            .first()
        )
        self.assertEqual(
            new_group.metadata[SUBMISSION_GROUP_LATEST_KEY],
            submission_log.date_created,
        )
        self.assertEqual(new_group.metadata[SUBMISSION_GROUP_COUNT_KEY], 1)

    def test_create_group_if_existing_groups_too_old(self):
        someuser = User.objects.get(username='someuser')
        jan_1_midnight = datetime.fromisoformat('2024-01-01 00:00:00+00:00')
        old_submission_group = create_submission_group_log(
            someuser,
            latest_date=jan_1_midnight,
        )
        old_submission_group.save()
        submission_log = create_submission_access_log(someuser)
        submission_log.save()
        # refetch from the database to make sure we have the most updated data
        refetched_old_group = AuditLog.objects.get(pk=old_submission_group.id)
        new_group = (
            SubmissionGroup.objects.filter(user=someuser)
            .order_by(f'-metadata__{SUBMISSION_GROUP_LATEST_KEY}')
            .first()
        )
        # make sure new group has correct data
        self.assertEqual(
            new_group.metadata[SUBMISSION_GROUP_LATEST_KEY],
            submission_log.date_created,
        )
        self.assertTrue(new_group.metadata[SUBMISSION_GROUP_COUNT_KEY], 1)
        # make sure old group was not updated
        self.assertEqual(
            refetched_old_group.metadata[SUBMISSION_GROUP_LATEST_KEY],
            jan_1_midnight,
        )
        self.assertEqual(
            refetched_old_group.metadata[SUBMISSION_GROUP_COUNT_KEY], 1
        )

    def test_create_group_if_existing_groups_wrong_user(self):
        someuser = User.objects.get(username='someuser')
        anotheruser = User.objects.get(username='anotheruser')
        jan_1_midnight = datetime.fromisoformat('2024-01-01 00:00:00+00:00')
        submission_group_wrong_user = create_submission_group_log(
            anotheruser,
            latest_date=jan_1_midnight,
        )
        submission_group_wrong_user.save()
        submission_log = create_submission_access_log(someuser)
        submission_log.date_created = jan_1_midnight + timedelta(seconds=2)
        submission_log.save()
        refetched_old_group = AuditLog.objects.get(
            pk=submission_group_wrong_user.id
        )
        new_group = (
            SubmissionGroup.objects.filter(user=someuser)
            .order_by(f'-metadata__{SUBMISSION_GROUP_LATEST_KEY}')
            .first()
        )
        # make sure new group has correct data
        self.assertEqual(
            new_group.metadata[SUBMISSION_GROUP_LATEST_KEY],
            submission_log.date_created,
        )
        self.assertTrue(new_group.metadata[SUBMISSION_GROUP_COUNT_KEY], 1)
        # make sure existing group was not updated
        self.assertEqual(
            refetched_old_group.metadata[SUBMISSION_GROUP_LATEST_KEY],
            jan_1_midnight,
        )
        self.assertEqual(
            refetched_old_group.metadata[SUBMISSION_GROUP_COUNT_KEY], 1
        )

    def test_add_submission_to_existing_group(self):
        someuser = User.objects.get(username='someuser')
        jan_1_midnight = datetime.fromisoformat('2024-01-01 00:00:00+00:00')
        submission_group = create_submission_group_log(
            someuser,
            latest_date=jan_1_midnight,
        )
        submission_group.save()
        submission_log = create_submission_access_log(someuser)
        submission_log.date_created = jan_1_midnight + timedelta(
            seconds=(GROUP_DELTA_MINUTES - 1) * 60
        )
        submission_log.save()
        refetched_group = AuditLog.objects.get(pk=submission_group.id)
        # make latest submission date and count were updated
        self.assertEqual(
            refetched_group.metadata[SUBMISSION_GROUP_COUNT_KEY], 2
        )
        self.assertEqual(
            refetched_group.metadata[SUBMISSION_GROUP_LATEST_KEY],
            submission_log.date_created,
        )
