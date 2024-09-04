from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.reverse import reverse

from kobo.apps.audit_log.models import (
    AccessLog,
    AuditAction,
    AuditLog,
    AuditType, SubmissionGroup, SubmissionAccessLog,
)
from kobo.apps.audit_log.serializers import AuditLogSerializer
from kobo.apps.audit_log.tests.test_utils import skip_login_access_log, skip_all_signals
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

    def assert_audit_log_results_equal(self, response, expected_kwargs):
        # utility method for tests that are just comparing the results of an api call to the results of
        # manually applying the expected query (simple filters only)
        expected = AccessLog.objects.filter(**expected_kwargs).order_by(
            '-date_created'
        )
        expected_count = expected.count()
        serializer = AuditLogSerializer(
            expected, many=True, context=response.renderer_context
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], expected_count)
        self.assertEqual(response.data['results'], serializer.data)


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


class ApiAccessLogTestCase(BaseAuditLogTestCase):

    def get_endpoint_basename(self):
        return 'access-log-list'

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


    def test_list_as_anonymous_returns_unauthorized(self):
        self.client.logout()
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_submission_logs_are_grouped_correctly(self):
        user = User.objects.get(username='someuser')
        with skip_all_signals():
            # manually assigned logs to groups, and groups to themselves
            submission_group_1: SubmissionGroup = SubmissionGroup.objects.create(user=user)
            submission_group_1.submission_group = submission_group_1
            submission_group_1.save()
            group_1_log_1: SubmissionAccessLog = SubmissionAccessLog.objects.create(user=user)
            group_1_log_2: SubmissionAccessLog = SubmissionAccessLog.objects.create(user=user)

            submission_group_2: SubmissionGroup = SubmissionGroup.objects.create(user=user)
            submission_group_2.submission_group = submission_group_2
            submission_group_2.save()
            group_2_log_1: SubmissionAccessLog = SubmissionAccessLog.objects.create(user=user)

            group_1_log_1.add_to_existing_submission_group(submission_group_1)
            group_1_log_2.add_to_existing_submission_group(submission_group_1)

            group_2_log_1.add_to_existing_submission_group(submission_group_2)

            # add 2 non-submission logs to make sure the grouping doesn't affect them
            regular_log_1 = AccessLog.objects.create(user=user)
            regular_log_2 = AccessLog.objects.create(user=user)
        self.force_login_user(user)
        response = self.client.get(self.url)
        self.assertEquals(response.data['count'], 4)
        self.assertEquals(
            response.data['results'],
            [
                self.get_expected_serialization(regular_log_2),
                self.get_expected_serialization(regular_log_1),
                self.get_expected_serialization(submission_group_2, count = 1),
                self.get_expected_serialization(submission_group_1, count = 2),
            ]
        )


    def test_show_user_access_logs_correctly_filters_to_user(self):
        user1 = User.objects.get(username='someuser')
        user2 = User.objects.get(username='anotheruser')
        log_1 = AccessLog.objects.create(user=user1)
        log_2 = AccessLog.objects.create(user=user2)
        self.force_login_user(user1)
        response = self.client.get(self.url)
        # only return user1's access logs
        self.assertEquals(response.data['count'], 1)
        self.assertEquals(
            response.data['results'],
            [
                self.get_expected_serialization(log_1)
            ]
        )

    def test_endpoint_ignores_querystring(self):
        user1 = User.objects.get(username='someuser')
        user2 = User.objects.get(username='anotheruser')
        log_1 = AccessLog.objects.create(user=user1)
        log_2 = AccessLog.objects.create(user=user2)
        self.force_login_user(user1)
        response = self.client.get(self.url)
        # only return user1's access logs
        self.assertEquals(response.data['count'], 1)
        self.assertEquals(
            response.data['results'],
            [
                self.get_expected_serialization(log_1)
            ]
        )


class AllApiAccessLogsTestCase(BaseAuditLogTestCase):

    def get_endpoint_basename(self):
        return 'all-access-logs-list'

    def setUp(self):
        super().setUp()
        super_user = User.objects.get(username='admin')
        user2 = User.objects.get(username='anotheruser')
        # generate 3 access logs, 2 for superuser, 1 for user2
        # generate 3 access logs, 2 for user1, 1 for user2
        user_1_log_1 = AccessLog.objects.create(user=super_user)
        user_1_log_2 = AccessLog.objects.create(user=super_user)
        user_2_log_1 = AccessLog.objects.create(user=super_user)

        # create a random non-auth audit log
        log = AuditLog.objects.create(
            user=User.objects.get(username='someuser'),
            app_label='foo',
            model_name='bar',
            object_id=1,
            action=AuditAction.DELETE,
        )
        self.assertEqual(AuditLog.objects.count(), 4)

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
        self.assert_audit_log_results_equal(
            response=response, expected_kwargs={'action': AuditAction.AUTH}
        )

    def test_can_search_access_logs_by_username(self):
        self.force_login_user(User.objects.get(username='admin'))
        response = self.client.get(f'{self.url}?q=user__username:anotheruser')
        another_user = User.objects.get(username='anotheruser')
        self.assert_audit_log_results_equal(
            response=response,
            expected_kwargs={'action': AuditAction.AUTH, 'user': another_user},
        )

    def test_can_search_access_logs_by_date(self):
        another_user = User.objects.get(username='anotheruser')
        with skip_login_access_log():
            self.client.force_login(User.objects.get(username='admin'))
        tomorrow = timezone.now() + timedelta(days=1)
        tomorrow_str = tomorrow.strftime('%Y-%m-%d')
        log = AccessLog.objects.create(user=another_user, date_created=tomorrow)
        response = self.client.get(
            f'{self.url}?q=date_created__gte:"{tomorrow_str}"'
        )
        serializer = AuditLogSerializer(
            [log], many=True, context=response.renderer_context
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'], serializer.data)
