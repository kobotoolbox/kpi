from datetime import datetime, timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.reverse import reverse

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AccessLog, AuditLog, AuditType, ProjectHistoryLog
from kobo.apps.audit_log.tests.test_signals import skip_login_access_log
from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import (
    ACCESS_LOG_SUBMISSION_AUTH_TYPE,
    ACCESS_LOG_SUBMISSION_GROUP_AUTH_TYPE,
    PERM_MANAGE_ASSET,
    PROJECT_HISTORY_LOG_PERMISSION_SUBTYPE,
    PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
)
from kpi.models import Asset
from kpi.models.import_export_task import (
    AccessLogExportTask,
    ProjectHistoryLogExportTask,
)
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


class ProjectHistoryLogTestCaseMixin:
    """
    Common tests for /project-history-logs and asset/<uid>/history
    """

    def test_results_have_expected_fields(self):
        now = timezone.now()
        metadata_dict = {
            'asset_uid': self.asset.uid,
            'ip_address': '1.2.3.4',
            'source': 'source',
            'log_subtype': 'project',
            'some': 'thing',
        }
        ProjectHistoryLog.objects.create(
            user=self.user,
            object_id=self.asset.id,
            action=AuditAction.DELETE,
            metadata=metadata_dict,
            date_created=now,
        )
        response = self.client.get(self.url)
        self.assertEqual(response.data['count'], 1)
        ph_log = response.data['results'][0]
        self.assertListEqual(
            sorted(list(ph_log.keys())),
            ['action', 'date_created', 'metadata', 'user', 'user_uid', 'username'],
        )
        self.assertEqual(ph_log['action'], AuditAction.DELETE),
        self.assertEqual(ph_log['date_created'], now.strftime('%Y-%m-%dT%H:%M:%SZ'))
        self.assertEqual(
            ph_log['user'],
            reverse(
                'api_v2:user-kpi-detail',
                kwargs={'username': self.user.username},
                request=response.wsgi_request,
            ),
        )
        self.assertEqual(ph_log['user_uid'], self.user.extra_details.uid)
        self.assertEqual(ph_log['username'], self.user.username)
        self.assertDictEqual(ph_log['metadata'], metadata_dict)

    def test_results_are_sorted_by_date_descending(self):
        now = timezone.now()
        yesterday = now - timedelta(days=1)
        ProjectHistoryLog.objects.create(
            user=self.user,
            object_id=self.asset.id,
            action=AuditAction.DELETE,
            metadata={
                'asset_uid': self.asset.uid,
                'ip_address': '1.2.3.4',
                'source': 'source',
                'log_subtype': 'project',
            },
            date_created=yesterday,
        )
        ProjectHistoryLog.objects.create(
            user=self.user,
            object_id=self.asset.id,
            action=AuditAction.DELETE,
            metadata={
                'asset_uid': self.asset.uid,
                'ip_address': '1.2.3.4',
                'source': 'source',
                'log_subtype': 'project',
            },
            date_created=now,
        )
        response = self.client.get(self.url)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(
            response.data['results'][0]['date_created'],
            now.strftime('%Y-%m-%dT%H:%M:%SZ'),
        )
        self.assertEqual(
            response.data['results'][1]['date_created'],
            yesterday.strftime('%Y-%m-%dT%H:%M:%SZ'),
        )

    def test_results_can_be_searched_by_subtype(self):
        now = timezone.now()
        yesterday = now - timedelta(days=1)
        ProjectHistoryLog.objects.create(
            user=self.user,
            object_id=self.asset.id,
            action=AuditAction.DELETE,
            metadata={
                'asset_uid': self.asset.uid,
                'ip_address': '1.2.3.4',
                'source': 'source',
                'log_subtype': PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
            },
            date_created=now,
        )
        ProjectHistoryLog.objects.create(
            user=self.user,
            object_id=self.asset.id,
            action=AuditAction.DELETE,
            metadata={
                'asset_uid': self.asset.uid,
                'ip_address': '1.2.3.4',
                'source': 'source',
                'log_subtype': PROJECT_HISTORY_LOG_PERMISSION_SUBTYPE,
            },
            date_created=yesterday,
        )
        response = self.client.get(
            f'{self.url}?q=metadata__log_subtype:'
            f'{PROJECT_HISTORY_LOG_PERMISSION_SUBTYPE}'
        )
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(
            response.data['results'][0]['metadata']['log_subtype'],
            PROJECT_HISTORY_LOG_PERMISSION_SUBTYPE,
        )

    def test_export_task_created(self):
        now = timezone.now()
        ProjectHistoryLog.objects.create(
            user=self.user,
            object_id=self.asset.id,
            action=AuditAction.DELETE,
            metadata={
                'asset_uid': self.asset.uid,
                'ip_address': '1.2.3.4',
                'source': 'source',
                'log_subtype': PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
            },
            date_created=now,
        )
        response = self.client.post(f'{self.url}export/')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        task = (
            ProjectHistoryLogExportTask.objects.filter(user=self.user)
            .order_by('-date_created')
            .first()
        )
        self.assertIsNotNone(task)
        self.assertIn(task.status, ['created', 'processing', 'complete'])


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
        self.login_user(username='adminuser', password='pass')
        expected = [
            {
                'app_label': 'foo',
                'model_name': 'bar',
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
        self.login_user(username='adminuser', password='pass')
        expected = [
            {
                'app_label': 'foo',
                'model_name': 'bar',
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

    def test_view_log_from_deleted_user(self):
        someuser = get_user_model().objects.get(username='someuser')
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
        someuser.delete()
        self.login_user(username='adminuser', password='pass')
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['results'][0]['username'] is None
        assert response.data['results'][0]['user'] is None


class ApiAccessLogTestCase(BaseAuditLogTestCase):

    def get_endpoint_basename(self):
        return 'access-log-list'

    def test_list_as_anonymous_returns_unauthorized(self):
        self.client.logout()
        response = self.client.get(self.url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_show_user_access_logs_correctly_filters_to_user(self):
        user1 = User.objects.get(username='someuser')
        user2 = User.objects.get(username='anotheruser')
        AccessLog.objects.create(user=user1)
        AccessLog.objects.create(user=user2)
        self.force_login_user(user1)

        response = self.client.get(self.url)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['username'], 'someuser')

    def test_endpoint_ignores_querystring(self):
        # make sure a user can't get someone else's access logs
        user1 = User.objects.get(username='someuser')
        user2 = User.objects.get(username='anotheruser')
        AccessLog.objects.create(user=user1)
        AccessLog.objects.create(user=user2)
        self.force_login_user(user1)
        response = self.client.get(f'{self.url}?q=user__username:anotheruser')
        # check we still only got logs for the logged-in user
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['username'], 'someuser')

    def test_endpoint_orders_results_by_date_desc(self):
        user1 = User.objects.get(username='someuser')
        today = timezone.now()
        yesterday = today - timedelta(days=1)
        self.force_login_user(user1)
        AccessLog.objects.create(user=user1, date_created=today)
        AccessLog.objects.create(user=user1, date_created=yesterday)
        response = self.client.get(self.url)
        first_result = response.data['results'][0]
        second_result = response.data['results'][1]
        self.assertEqual(
            first_result['date_created'], today.strftime('%Y-%m-%dT%H:%M:%SZ')
        )
        self.assertEqual(
            second_result['date_created'],
            yesterday.strftime('%Y-%m-%dT%H:%M:%SZ'),
        )

    def test_endpoint_groups_submissions(self):
        # the logic of grouping submissions is tested more thoroughly in test_models,
        # this is just to ensure that we're using the grouping query
        user = User.objects.get(username='someuser')
        self.force_login_user(user)
        jan_1_1_30_am = datetime.fromisoformat(
            '2024-01-01T01:30:25.123456+00:00'
        )
        jan_1_1_45_am = datetime.fromisoformat(
            '2024-01-01T01:45:25.123456+00:00'
        )
        AccessLog.objects.create(
            user=user,
            metadata={'auth_type': ACCESS_LOG_SUBMISSION_AUTH_TYPE},
            date_created=jan_1_1_30_am,
        )
        AccessLog.objects.create(
            user=user,
            metadata={'auth_type': ACCESS_LOG_SUBMISSION_AUTH_TYPE},
            date_created=jan_1_1_45_am,
        )
        response = self.client.get(self.url)
        # should return 1 submission group with 2 submissions
        self.assertEqual(response.data['count'], 1)
        result = response.data['results'][0]
        self.assertEqual(
            result['metadata']['auth_type'],
            ACCESS_LOG_SUBMISSION_GROUP_AUTH_TYPE,
        )
        self.assertEqual(result['count'], 2)


class AllApiAccessLogsTestCase(BaseAuditLogTestCase):

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
        self.force_login_user(User.objects.get(username='adminuser'))
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_show_all_access_logs_includes_all_users(self):
        user1 = User.objects.get(username='someuser')
        user2 = User.objects.get(username='anotheruser')
        admin = User.objects.get(username='adminuser')
        AccessLog.objects.create(user=user1)
        AccessLog.objects.create(user=user2)
        self.force_login_user(admin)
        response = self.client.get(self.url)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(response.data['results'][0]['username'], 'anotheruser')
        self.assertEqual(response.data['results'][1]['username'], 'someuser')

    def test_endpoint_groups_submissions(self):
        # the logic of grouping submissions is tested more thoroughly in test_models,
        # this is just to ensure that we're using the grouping query
        user1 = User.objects.get(username='someuser')
        user2 = User.objects.get(username='anotheruser')
        admin = User.objects.get(username='adminuser')

        self.force_login_user(admin)
        jan_1_1_30_am = datetime.fromisoformat('2024-01-01T01:30:25.123456+00:00')
        jan_1_1_45_am = datetime.fromisoformat('2024-01-01T01:45:25.123456+00:00')
        jan_1_1_50_am = datetime.fromisoformat('2024-01-01T01:50:25.123456+00:00')

        # create 2 submissions for user1
        AccessLog.objects.create(
            user=user1,
            metadata={'auth_type': ACCESS_LOG_SUBMISSION_AUTH_TYPE},
            date_created=jan_1_1_30_am,
        )
        AccessLog.objects.create(
            user=user1,
            metadata={'auth_type': ACCESS_LOG_SUBMISSION_AUTH_TYPE},
            date_created=jan_1_1_45_am,
        )

        # 2 submissions for user2, after the ones for user1 so we know the expected
        # order of the results
        AccessLog.objects.create(
            user=user2,
            metadata={'auth_type': ACCESS_LOG_SUBMISSION_AUTH_TYPE},
            date_created=jan_1_1_45_am,
        )
        AccessLog.objects.create(
            user=user2,
            metadata={'auth_type': ACCESS_LOG_SUBMISSION_AUTH_TYPE},
            date_created=jan_1_1_50_am,
        )
        response = self.client.get(self.url)
        # should return 2 submission group with 2 submissions each
        self.assertEqual(response.data['count'], 2)

        # user2's submission group should be first
        group1 = response.data['results'][0]
        self.assertEqual(
            group1['metadata']['auth_type'],
            ACCESS_LOG_SUBMISSION_GROUP_AUTH_TYPE,
        )
        self.assertEqual(group1['username'], 'anotheruser')
        self.assertEqual(group1['count'], 2)

        # user1's group
        group2 = response.data['results'][1]
        self.assertEqual(
            group2['metadata']['auth_type'],
            ACCESS_LOG_SUBMISSION_GROUP_AUTH_TYPE,
        )
        self.assertEqual(group2['username'], 'someuser')
        self.assertEqual(group2['count'], 2)

    def test_can_search_access_logs_by_username(self):
        user1 = User.objects.get(username='someuser')
        user2 = User.objects.get(username='anotheruser')
        AccessLog.objects.create(user=user1)
        AccessLog.objects.create(user=user2)
        self.force_login_user(User.objects.get(username='adminuser'))
        response = self.client.get(f'{self.url}?q=user__username:anotheruser')

        # only return logs from user1
        for audit_log_dict in response.data['results']:
            self.assertEqual(audit_log_dict['username'], 'anotheruser')
        self.assertEqual(response.data['count'], 1)

    def test_can_search_access_logs_by_username_including_submission_groups(
        self,
    ):
        user1 = User.objects.get(username='someuser')
        user2 = User.objects.get(username='anotheruser')
        admin = User.objects.get(username='adminuser')
        self.force_login_user(admin)

        # create two submissions that will be grouped together
        # these are the only two logs for user admin
        jan_1_1_30_am = datetime.fromisoformat('2024-01-01T01:30:25.123456+00:00')
        jan_1_1_45_am = datetime.fromisoformat('2024-01-01T01:45:25.123456+00:00')
        AccessLog.objects.create(
            user=user1,
            metadata={'auth_type': ACCESS_LOG_SUBMISSION_AUTH_TYPE},
            date_created=jan_1_1_30_am,
        )
        AccessLog.objects.create(
            user=user1,
            metadata={'auth_type': ACCESS_LOG_SUBMISSION_AUTH_TYPE},
            date_created=jan_1_1_45_am,
        )

        # create an extra log for user2 so we know it gets filtered out
        AccessLog.objects.create(user=user2)

        response = self.client.get(f'{self.url}?q=user__username:someuser')
        self.assertEqual(response.data['count'], 1)
        result = response.data['results'][0]
        self.assertEqual(result['username'], 'someuser')
        self.assertEqual(
            result['metadata']['auth_type'],
            ACCESS_LOG_SUBMISSION_GROUP_AUTH_TYPE,
        )

    def test_can_search_access_logs_by_date(self):
        user = User.objects.get(username='someuser')
        with skip_login_access_log():
            self.client.force_login(User.objects.get(username='adminuser'))
        tomorrow = timezone.now() + timedelta(days=1)
        tomorrow_str = tomorrow.strftime('%Y-%m-%d')
        # create one log from today and one from tomorrow
        AccessLog.objects.create(user=user)
        AccessLog.objects.create(
            user=user,
            date_created=tomorrow,
        )
        response = self.client.get(
            f'{self.url}?q=date_created__gte:"{tomorrow_str}"'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # should only return the log from tomorrow
        self.assertEqual(response.data['count'], 1)
        result = response.data['results'][0]
        self.assertEqual(
            result['date_created'], tomorrow.strftime('%Y-%m-%dT%H:%M:%SZ')
        )

    def test_can_search_access_logs_by_date_including_submission_groups(self):
        user = User.objects.get(username='someuser')
        with skip_login_access_log():
            self.client.force_login(User.objects.get(username='adminuser'))
        tomorrow = timezone.now() + timedelta(days=1)
        two_days_from_now = tomorrow + timedelta(days=1)
        tomorrow_str = tomorrow.strftime('%Y-%m-%d')

        # create one log from today
        AccessLog.objects.create(user=user)

        # create 2 new submissions with a forced date_created of tomorrow
        AccessLog.objects.create(
            user=user,
            date_created=two_days_from_now,
            metadata={'auth_type': ACCESS_LOG_SUBMISSION_AUTH_TYPE},
        )
        AccessLog.objects.create(
            user=user,
            date_created=two_days_from_now,
            metadata={'auth_type': ACCESS_LOG_SUBMISSION_AUTH_TYPE},
        )

        # search for logs created after tomorrow
        response = self.client.get(f'{self.url}?q=date_created__gte:"{tomorrow_str}"')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # should only return the submission group
        self.assertEqual(response.data['count'], 1)
        group = response.data['results'][0]
        self.assertEqual(
            group['date_created'],
            two_days_from_now.strftime('%Y-%m-%dT%H:%M:%SZ'),
        )
        self.assertEqual(
            group['metadata']['auth_type'],
            ACCESS_LOG_SUBMISSION_GROUP_AUTH_TYPE,
        )


class ApiProjectHistoryLogsTestCase(BaseTestCase, ProjectHistoryLogTestCaseMixin):

    fixtures = ['test_data']

    def setUp(self):
        super().setUp()
        self.asset = Asset.objects.get(pk=1)
        self.url = reverse(
            'api_v2:history-list', kwargs={'parent_lookup_asset': self.asset.uid}
        )
        self.user = User.objects.get(username='someuser')
        self.asset.assign_perm(user_obj=self.user, perm=PERM_MANAGE_ASSET)
        self.default_metadata = {
            'ip_address': '1.2.3.4',
            'source': 'source',
            'log_subtype': 'project',
        }
        self.client.force_login(self.user)

    def test_list_without_permissions_returns_forbidden(self):
        user2 = User.objects.get(username='anotheruser')
        self.client.force_login(user2)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.asset.assign_perm(user_obj=user2, perm=PERM_MANAGE_ASSET)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_actions_without_permissions_returns_forbidden(self):
        user2 = User.objects.get(username='anotheruser')
        self.client.force_login(user2)
        response = self.client.get(f'{self.url}actions/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.asset.assign_perm(user_obj=user2, perm=PERM_MANAGE_ASSET)
        response = self.client.get(f'{self.url}actions/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_show_project_history_logs_filters_to_project(self):
        asset2 = Asset.objects.get(pk=2)
        ProjectHistoryLog.objects.create(
            user=self.user,
            object_id=self.asset.id,
            action=AuditAction.DELETE,
            metadata={**self.default_metadata, 'asset_uid': self.asset.uid},
        )
        ProjectHistoryLog.objects.create(
            user=self.user,
            object_id=asset2.id,
            action=AuditAction.DELETE,
            metadata={**self.default_metadata, 'asset_uid': asset2.uid},
        )
        response = self.client.get(self.url)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(
            response.data['results'][0]['metadata']['asset_uid'], self.asset.uid
        )

    def test_get_all_actions_for_asset(self):
        asset2 = Asset.objects.get(pk=2)
        expected_actions = [
            AuditAction.DELETE_MEDIA,
            AuditAction.DELETE_SERVICE,
            AuditAction.DEPLOY,
        ]
        for action in expected_actions:
            # create 2 logs for each action so we can make sure we get distinct values
            for i in range(2):
                ProjectHistoryLog.objects.create(
                    user=self.user,
                    object_id=self.asset.id,
                    action=action,
                    metadata={**self.default_metadata, 'asset_uid': self.asset.uid},
                )
        # create 1 log for a different project so we know we're still filtering
        # correctly
        ProjectHistoryLog.objects.create(
            user=self.user,
            object_id=asset2.id,
            action=AuditAction.ARCHIVE,
            metadata={**self.default_metadata, 'asset_uid': asset2.uid},
        )
        response = self.client.get(f'{self.url}actions/')
        self.assertListEqual(
            # order returned doesn't matter
            sorted(response.data['actions']),
            [AuditAction.DELETE_MEDIA, AuditAction.DELETE_SERVICE, AuditAction.DEPLOY],
        )

    def test_export_creates_task_for_single_asset(self):
        response = self.client.post(f'{self.url}export/')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        task = (
            ProjectHistoryLogExportTask.objects.filter(user=self.user)
            .order_by('-date_created')
            .first()
        )
        self.assertEqual(task.asset_uid, self.asset.uid)

    def test_cannot_export_without_manage_permission(self):
        user2 = User.objects.get(username='anotheruser')
        # make sure this user doesn't have management permissions
        self.asset.remove_perm(user_obj=user2, perm=PERM_MANAGE_ASSET)
        self.client.force_login(user=user2)
        response = self.client.post(f'{self.url}export/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ApiAllProjectHistoryLogsTestCase(
    BaseAuditLogTestCase, ProjectHistoryLogTestCaseMixin
):

    def get_endpoint_basename(self):
        return 'all-project-history-logs-list'

    def setUp(self):
        super().setUp()
        self.user = User.objects.get(username='adminuser')
        self.asset = Asset.objects.get(pk=1)
        self.force_login_user(self.user)

    def test_show_all_project_history_logs(self):
        asset1 = Asset.objects.get(pk=1)
        asset2 = Asset.objects.get(pk=2)
        ProjectHistoryLog.objects.create(
            user=self.user,
            object_id=asset1.id,
            action=AuditAction.DELETE,
            metadata={
                'asset_uid': asset1.uid,
                'ip_address': '1.2.3.4',
                'source': 'source',
                'log_subtype': 'project',
            },
        )
        ProjectHistoryLog.objects.create(
            user=self.user,
            object_id=asset2.id,
            action=AuditAction.DELETE,
            metadata={
                'asset_uid': asset2.uid,
                'ip_address': '1.2.3.4',
                'source': 'source',
                'log_subtype': 'project',
            },
        )
        response = self.client.get(self.url)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(
            response.data['results'][0]['metadata']['asset_uid'], asset2.uid
        )
        self.assertEqual(
            response.data['results'][1]['metadata']['asset_uid'], asset1.uid

        )

    def test_export_creates_task_for_all_assets(self):
        response = self.client.post(f'{self.url}export/')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        task = (
            ProjectHistoryLogExportTask.objects.filter(user=self.user)
            .order_by('-date_created')
            .first()
        )
        # empty task uid means the task is for all PH logs
        self.assertEqual(task.asset_uid, None)

    def test_cannot_export_all_if_not_superuser(self):
        user2 = User.objects.get(username='anotheruser')
        self.client.force_login(user=user2)
        response = self.client.post(f'{self.url}export/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ApiAccessLogsExportTestCase(BaseAuditLogTestCase):

    def get_endpoint_basename(self):
        return 'access-logs-export-list'

    def test_export_as_anonymous_returns_unauthorized(self):
        self.client.logout()
        response = self.client.post(self.url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_export_for_user_returns_success(self):
        self.force_login_user(User.objects.get(username='anotheruser'))
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_export_for_superuser_commences(self):
        self.force_login_user(User.objects.get(username='adminuser'))
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_create_export_task_on_post(self):
        test_user = User.objects.get(username='anotheruser')
        self.force_login_user(test_user)

        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        task = (
            AccessLogExportTask.objects.filter(user=test_user)
            .order_by('-date_created')
            .first()
        )
        self.assertIsNotNone(task)
        self.assertIn(task.status, ['created', 'processing', 'complete'])
        self.assertFalse(task.get_all_logs)

    def test_get_status_of_tasks(self):
        test_user = User.objects.get(username='anotheruser')
        self.force_login_user(test_user)

        AccessLogExportTask.objects.create(
            user=test_user,
            get_all_logs=False,
            data={
                'type': 'access_logs_export',
            },
        )

        response_status = self.client.get(self.url)
        self.assertEqual(response_status.status_code, status.HTTP_200_OK)

        # Assert the response contains a list of tasks
        tasks = response_status.json()
        self.assertIsInstance(tasks, list)
        self.assertGreater(len(tasks), 0)  # Ensure at least one task is present

        # Assert the structure of the first task in the list
        first_task = tasks[0]
        self.assertIn('uid', first_task)
        self.assertIn('status', first_task)
        self.assertIn('date_created', first_task)

    def test_multiple_export_tasks_not_allowed(self):
        test_user = User.objects.get(username='anotheruser')
        self.force_login_user(test_user)

        response_first = self.client.post(self.url)
        self.assertEqual(response_first.status_code, status.HTTP_202_ACCEPTED)

        task = (
            AccessLogExportTask.objects.filter(user=test_user)
            .order_by('-date_created')
            .first()
        )
        task.status = 'processing'
        task.save()

        response_second = self.client.post(self.url)
        self.assertEqual(response_second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(
            'Export task for user access logs already in progress.',
            response_second.json()['error'],
        )


class AllApiAccessLogsExportTestCase(BaseAuditLogTestCase):

    def get_endpoint_basename(self):
        return 'all-access-logs-export-list'

    def test_export_as_anonymous_returns_unauthorized(self):
        self.client.logout()
        response = self.client.post(self.url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_regular_user_cannot_export_access_logs(self):
        self.force_login_user(User.objects.get(username='anotheruser'))
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_export_access_logs_for_superuser_returns_success(self):
        self.force_login_user(User.objects.get(username='adminuser'))
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

    def test_superuser_create_export_task_on_post(self):
        test_superuser = User.objects.get(username='adminuser')
        self.force_login_user(test_superuser)

        response = self.client.post(self.url)
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)

        task = (
            AccessLogExportTask.objects.filter(user=test_superuser)
            .order_by('-date_created')
            .first()
        )
        self.assertIsNotNone(task)
        self.assertIn(task.status, ['created', 'processing', 'complete'])
        self.assertTrue(task.get_all_logs)

    def test_superuser_get_status_tasks(self):
        test_superuser = User.objects.get(username='adminuser')
        self.force_login_user(test_superuser)

        AccessLogExportTask.objects.create(
            user=test_superuser,
            get_all_logs=False,
            data={
                'type': 'access_logs_export',
            },
        )

        response_status = self.client.get(self.url)
        self.assertEqual(response_status.status_code, status.HTTP_200_OK)

        # Assert the response contains a list of tasks
        tasks = response_status.json()
        self.assertIsInstance(tasks, list)
        self.assertGreater(len(tasks), 0)  # Ensure at least one task is present

        # Assert the structure of the first task in the list
        first_task = tasks[0]
        self.assertIn('uid', first_task)
        self.assertIn('status', first_task)
        self.assertIn('date_created', first_task)

    def test_permission_denied_for_non_superusers_on_get_status(self):
        non_superuser = User.objects.get(username='anotheruser')
        self.force_login_user(non_superuser)

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_multiple_export_tasks_not_allowed(self):
        test_superuser = User.objects.get(username='adminuser')
        self.force_login_user(test_superuser)

        response_first = self.client.post(self.url)
        self.assertEqual(response_first.status_code, status.HTTP_202_ACCEPTED)

        task = (
            AccessLogExportTask.objects.filter(user=test_superuser)
            .order_by('-date_created')
            .first()
        )
        task.status = 'processing'
        task.save()

        response_second = self.client.post(self.url)
        self.assertEqual(response_second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(
            'Export task for all access logs already in progress.',
            response_second.json()['error'],
        )
