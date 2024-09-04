from datetime import timedelta
from unittest.mock import patch

from allauth.account.models import EmailAddress
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from trench.utils import get_mfa_model

from kobo.apps.audit_log.models import (
    AuditAction,
    AuditLog,
    SubmissionAccessLog,
    SubmissionGroup,
)
from kobo.apps.audit_log.tests.test_utils import skip_login_access_log
from kobo.apps.kobo_auth.shortcuts import User
from kobo.settings.base import ACCESS_LOG_SUBMISSION_GROUP_TIME_LIMIT_MINUTES
from kpi.tests.base_test_case import BaseTestCase


class AuditLogSignalsTestCase(BaseTestCase):
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

    @patch('kobo.apps.audit_log.signals.AccessLog.create_from_request')
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
        user = AuditLogSignalsTestCase.user
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
        user = AuditLogSignalsTestCase.user
        data = {
            'login': 'user',
            'password': 'pass',
        }
        self.client.post(reverse('kobo_login'), data=data, follow=True)
        # no audit log should be created yet because the email has not been verified
        self.assertEqual(AuditLog.objects.count(), 0)
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
            user=AuditLogSignalsTestCase.user,
            secret='dummy_mfa_secret',
            name='app',
            is_primary=True,
            is_active=True,
            _backup_codes='dummy_encoded_codes',
        )
        mfa_object.save()
        email_address, _ = EmailAddress.objects.get_or_create(
            user=AuditLogSignalsTestCase.user
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
            return_value=AuditLogSignalsTestCase.user,
        ):
            self.client.post(
                reverse('mfa_token'),
                data={'code': '123456', 'ephemeral_token': 'dummy'},
                follow=True,
            )
        self.assertEqual(AuditLog.objects.count(), 1)
        audit_log = AuditLog.objects.first()
        self.assertEqual(audit_log.user.id, AuditLogSignalsTestCase.user.id)
        self.assertEqual(audit_log.action, AuditAction.AUTH)

    def test_loginas(self):
        AuditLogSignalsTestCase.user.is_superuser = True
        AuditLogSignalsTestCase.user.save()
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


class SubmissionGroupSignalsTestCase(BaseTestCase):
    """
    Test signals around the creation and assignment of submission groups
    """

    fixtures = ['test_data']

    def test_new_group_for_new_submission(self):
        self.assertEqual(AuditLog.objects.count(), 0)
        user = User.objects.get(username='someuser')
        new_submission = SubmissionAccessLog.objects.create(user=user)
        # make sure a new group was made and assigned as the submission group for the submission
        self.assertEqual(SubmissionGroup.objects.count(), 1)
        group_log = SubmissionGroup.objects.first()
        self.assertEqual(group_log.user.id, user.id)
        self.assertEqual(new_submission.submission_group.id, group_log.id)
        self.assertEqual(group_log.date_created, new_submission.date_created)

    # make sure the time limit is long enough that the logs *could* be grouped together
    # if the users matched
    @override_settings(ACCESS_LOG_SUBMISSION_GROUP_TIME_LIMIT_MINUTES=60)
    def test_new_group_for_new_submission_if_existing_groups_have_wrong_user(
        self,
    ):
        user1 = User.objects.get(username='someuser')
        user2 = User.objects.get(username='anotheruser')
        # create a new submission with the first user
        user1_submission = SubmissionAccessLog.objects.create(user=user1)
        # make sure that created a new group
        user1_group_query = SubmissionGroup.objects.filter(user=user1)
        self.assertEqual(user1_group_query.count(), 1)
        user1_group = user1_group_query.first()
        self.assertEqual(user1_submission.submission_group.id, user1_group.id)

        # create a submission with the second user
        user2_submission = SubmissionAccessLog.objects.create(user=user2)
        user2_group_query = SubmissionGroup.objects.filter(user=user2)
        self.assertEqual(user2_group_query.count(), 1)
        new_group = user2_group_query.first()
        self.assertEqual(user2_submission.submission_group.id, new_group.id)

    @override_settings(ACCESS_LOG_SUBMISSION_GROUP_TIME_LIMIT_MINUTES=5)
    def test_new_group_for_new_submission_if_existing_groups_too_old(self):
        user = User.objects.get(username='someuser')
        ten_minutes_ago = timezone.now() - timedelta(minutes=10)
        old_submission = SubmissionAccessLog.objects.create(
            user=user, date_created=ten_minutes_ago
        )

        # make sure that created a new group
        group_query = SubmissionGroup.objects.filter(user=user)
        self.assertEqual(group_query.count(), 1)
        old_group = group_query.first()
        self.assertEqual(old_submission.submission_group.id, old_group.id)

        # new submission
        new_submission = SubmissionAccessLog.objects.create(user=user)
        self.assertEqual(group_query.count(), 2)
        new_group = group_query.order_by('-date_created').first()
        self.assertEqual(new_submission.submission_group.id, new_group.id)
