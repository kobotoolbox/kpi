from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.reverse import reverse

from kobo.apps.audit_log.models import (
    AccessLog,
    AuditAction,
    AuditLog,
    AuditType,
    SubmissionAccessLog,
    SubmissionGroup,
)
from kobo.apps.audit_log.serializers import AuditLogSerializer
from kobo.apps.audit_log.tests.test_utils import (
    skip_all_signals,
    skip_login_access_log,
)
from kobo.apps.kobo_auth.shortcuts import User
from kpi.tests.base_test_case import BaseTestCase
from kpi.urls.router_api_v2 import URL_NAMESPACE as ROUTER_URL_NAMESPACE


class BaseAuditLogTestCase(BaseTestCase):

    fixtures = ['test_data']
    URL_NAMESPACE = ROUTER_URL_NAMESPACE

    def get_endpoint_basename(self):
        raise NotImplementedError

    def setUp(self):
        super(BaseAuditLogTestCase, self).setUp()
        self.url = reverse(self._get_endpoint(self.get_endpoint_basename()))

    def login_user(self, username, password):
        # always skip creating the access logs for logins so we have full control over the logs in the test db
        with skip_login_access_log():
            self.client.login(username=username, password=password)

    def force_login_user(self, user):
        # always skip creating the access logs for logins so we have full control over the logs in the test db
        with skip_login_access_log():
            self.client.force_login(user)


class CompareAccessLogResultsMixin:
    def get_expected_serialization(self, log: AccessLog, count=0):
        # the query changes results to dicts before serialization, so we can't just call serializer(log).data
        # to get the expected serialization
        return {
            'object_id': log.user.id,
            'user': f'http://testserver/api/v2/users/{log.user.username}/',
            'user_uid': log.user.extra_details.uid,
            'username': log.user.username,
            'metadata': log.metadata,
            'date_created': log.date_created.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'count': count,
        }


class ApiAuditLogTestCase(BaseAuditLogTestCase):

    def get_endpoint_basename(self):
        return 'audit-log-list'

    def test_list_as_anonymous(self):
        self.client.logout()
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_as_regular_user(self):
        self.login_user(username='someuser', password='someuser')
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_list_as_staff_user(self):
        someuser = get_user_model().objects.get(username='someuser')
        # Promote someuser as a staff user.
        someuser.is_staff = True
        someuser.save()

        self.login_user(username='someuser', password='someuser')
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_list_as_superuser(self):
        someuser = get_user_model().objects.get(username='someuser')
        date_created = timezone.now().strftime('%Y-%m-%dT%H:%M:%SZ')
        AuditLog.objects.create(
            user=someuser,
            app_label='foo',
            model_name='bar',
            object_id=1,
            date_created=date_created,
            action=AuditAction.DELETE,
            log_type=AuditType.DATA_EDITING,
        )
        self.login_user(username='admin', password='pass')
        expected = [
            {
                'app_label': 'foo',
                'model_name': 'bar',
                'object_id': 1,
                'user': 'http://testserver/api/v2/users/someuser/',
                'user_uid': someuser.extra_details.uid,
                'action': 'delete',
                'username': 'someuser',
                'metadata': {},
                'date_created': date_created,
                'log_type': 'data-editing',
            },
        ]
        response = self.client.get(self.url)
        audit_logs_count = AuditLog.objects.count()
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == audit_logs_count
        assert response.data['results'] == expected

    def test_filter_list(self):
        someuser = get_user_model().objects.get(username='someuser')
        anotheruser = get_user_model().objects.get(username='anotheruser')
        date_created = timezone.now().strftime('%Y-%m-%dT%H:%M:%SZ')
        AuditLog.objects.create(
            user=someuser,
            app_label='foo',
            model_name='bar',
            object_id=1,
            date_created=date_created,
            action=AuditAction.UPDATE,
            log_type=AuditType.DATA_EDITING,
        )
        AuditLog.objects.create(
            user=anotheruser,
            app_label='foo',
            model_name='bar',
            object_id=1,
            date_created=date_created,
            action=AuditAction.DELETE,
            log_type=AuditType.DATA_EDITING,
        )
        self.login_user(username='admin', password='pass')
        expected = [
            {
                'app_label': 'foo',
                'model_name': 'bar',
                'object_id': 1,
                'user': 'http://testserver/api/v2/users/anotheruser/',
                'user_uid': anotheruser.extra_details.uid,
                'action': 'delete',
                'metadata': {},
                'date_created': date_created,
                'log_type': 'data-editing',
                'username': 'anotheruser',
            }
        ]
        response = self.client.get(f'{self.url}?q=action:delete')
        audit_logs_count = AuditLog.objects.count()
        assert response.status_code == status.HTTP_200_OK
        assert audit_logs_count == 2
        assert response.data['count'] == 1
        assert response.data['results'] == expected


class ApiAccessLogTestCase(BaseAuditLogTestCase, CompareAccessLogResultsMixin):

    def get_endpoint_basename(self):
        return 'access-log-list'

    def test_list_as_anonymous_returns_unauthorized(self):
        self.client.logout()
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_submission_logs_are_grouped_correctly(self):
        user = User.objects.get(username='someuser')
        with skip_all_signals():
            # manually assigned logs to groups, and groups to themselves
            # submission group 1 has 2 submissions
            submission_group_1: SubmissionGroup = (
                SubmissionGroup.objects.create(user=user)
            )
            submission_group_1.submission_group = submission_group_1
            submission_group_1.save()
            group_1_log_1: SubmissionAccessLog = (
                SubmissionAccessLog.objects.create(user=user)
            )
            group_1_log_2: SubmissionAccessLog = (
                SubmissionAccessLog.objects.create(user=user)
            )

            group_1_log_1.add_to_existing_submission_group(submission_group_1)
            group_1_log_1.save()
            group_1_log_2.add_to_existing_submission_group(submission_group_1)
            group_1_log_2.save()

            # submission group 2 has 1 submissions
            submission_group_2: SubmissionGroup = (
                SubmissionGroup.objects.create(user=user)
            )
            submission_group_2.submission_group = submission_group_2
            submission_group_2.save()
            group_2_log_1: SubmissionAccessLog = (
                SubmissionAccessLog.objects.create(user=user)
            )

            group_2_log_1.add_to_existing_submission_group(submission_group_2)
            group_2_log_1.save()

            # add 2 non-submission logs to make sure the grouping doesn't affect them
            regular_log_1 = AccessLog.objects.create(user=user)
            regular_log_2 = AccessLog.objects.create(user=user)
        self.force_login_user(user)
        response = self.client.get(self.url)
        self.assertEqual(response.data['count'], 4)
        self.assertEqual(
            response.data['results'],
            [
                self.get_expected_serialization(regular_log_2),
                self.get_expected_serialization(regular_log_1),
                self.get_expected_serialization(submission_group_2, count=1),
                self.get_expected_serialization(submission_group_1, count=2),
            ],
        )

    def test_show_user_access_logs_correctly_filters_to_user(self):
        user1 = User.objects.get(username='someuser')
        user2 = User.objects.get(username='anotheruser')
        log_1 = AccessLog.objects.create(user=user1)
        log_2 = AccessLog.objects.create(user=user2)
        self.force_login_user(user1)
        response = self.client.get(self.url)
        # only return user1's access logs
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(
            response.data['results'], [self.get_expected_serialization(log_1)]
        )

    def test_endpoint_ignores_querystring(self):
        user1 = User.objects.get(username='someuser')
        user2 = User.objects.get(username='anotheruser')
        log_1 = AccessLog.objects.create(user=user1)
        log_2 = AccessLog.objects.create(user=user2)
        self.force_login_user(user1)
        response = self.client.get(f'{self.url}?q=user__username:anotheruser')
        # still only return user1's access logs
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(
            response.data['results'], [self.get_expected_serialization(log_1)]
        )


class AllApiAccessLogsTestCase(
    BaseAuditLogTestCase, CompareAccessLogResultsMixin
):

    def get_endpoint_basename(self):
        return 'all-access-logs-list'

    def test_list_as_anonymous_returns_unauthorized(self):
        self.client.logout()
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_regular_user_access_returns_forbidden(self):
        self.force_login_user(User.objects.get(username='anotheruser'))
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_show_all_access_logs_succeeds_for_superuser(self):
        self.force_login_user(User.objects.get(username='admin'))
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_submission_logs_are_grouped_correctly(self):
        admin = User.objects.get(username='admin')
        self.force_login_user(admin)
        with skip_all_signals():
            # manually assigned logs to groups, and groups to themselves
            # submission group 1 has 2 submissions
            submission_group_1: SubmissionGroup = (
                SubmissionGroup.objects.create(user=admin)
            )
            submission_group_1.submission_group = submission_group_1
            submission_group_1.save()
            group_1_log_1: SubmissionAccessLog = (
                SubmissionAccessLog.objects.create(user=admin)
            )
            group_1_log_2: SubmissionAccessLog = (
                SubmissionAccessLog.objects.create(user=admin)
            )
            group_1_log_1.add_to_existing_submission_group(submission_group_1)
            group_1_log_1.save()
            group_1_log_2.add_to_existing_submission_group(submission_group_1)
            group_1_log_2.save()

            # submission group 2 has 2 submissions
            submission_group_2: SubmissionGroup = (
                SubmissionGroup.objects.create(user=admin)
            )
            submission_group_2.submission_group = submission_group_2
            submission_group_2.save()
            group_2_log_1: SubmissionAccessLog = (
                SubmissionAccessLog.objects.create(user=admin)
            )

            group_2_log_1.add_to_existing_submission_group(submission_group_2)
            group_2_log_1.save()

            # add 2 non-submission logs to make sure the grouping doesn't affect them
            regular_log_1 = AccessLog.objects.create(user=admin)
            regular_log_2 = AccessLog.objects.create(user=admin)
        self.force_login_user(admin)
        response = self.client.get(self.url)
        self.assertEqual(response.data['count'], 4)
        self.assertEqual(
            response.data['results'],
            [
                self.get_expected_serialization(regular_log_2),
                self.get_expected_serialization(regular_log_1),
                self.get_expected_serialization(submission_group_2, count=1),
                self.get_expected_serialization(submission_group_1, count=2),
            ],
        )

    def test_returns_logs_for_all_users(self):
        self.force_login_user(User.objects.get(username='admin'))
        user1 = User.objects.get(username='someuser')
        user2 = User.objects.get(username='anotheruser')
        user_1_log = AccessLog.objects.create(user=user1)
        user_2_log = AccessLog.objects.create(user=user2)
        response = self.client.get(self.url)

        # we should get the logs for both user1 and user2
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(
            response.data['results'],
            [
                self.get_expected_serialization(user_2_log),
                self.get_expected_serialization(user_1_log),
            ],
        )

    def test_can_search_access_logs_by_username(self):
        self.force_login_user(User.objects.get(username='admin'))
        user1 = User.objects.get(username='someuser')
        user2 = User.objects.get(username='anotheruser')
        user_1_log = AccessLog.objects.create(user=user1)
        user_2_log = AccessLog.objects.create(user=user2)
        response = self.client.get(f'{self.url}?q=user__username:anotheruser')

        # we should only get logs from user2
        self.assertEqual(response.data['count'], 1)
        self.assertDictEqual(
            response.data['results'][0],
            self.get_expected_serialization(user_2_log),
        )

    def test_can_search_access_logs_by_date(self):
        self.force_login_user(User.objects.get(username='admin'))
        another_user = User.objects.get(username='anotheruser')

        tomorrow = timezone.now() + timedelta(days=1)
        tomorrow_str = tomorrow.strftime('%Y-%m-%d')
        tomorrow_log = AccessLog.objects.create(
            user=another_user, date_created=tomorrow
        )
        old_log = AccessLog.objects.create(user=another_user)
        response = self.client.get(
            f'{self.url}?q=date_created__gte:"{tomorrow_str}"'
        )

        # only one log has a date_created >= tomorrow
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(
            response.data['results'][0],
            self.get_expected_serialization(tomorrow_log),
        )
