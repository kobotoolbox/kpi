import csv
from datetime import datetime, timedelta

from django.conf import settings
from django.core.files.storage import default_storage
from django.test import override_settings
from django.utils import timezone
from model_bakery import baker

from kobo.apps.audit_log.audit_actions import AuditAction
from kobo.apps.audit_log.models import AccessLog, ProjectHistoryLog
from kobo.apps.kobo_auth.shortcuts import User
from kpi.constants import PERM_MANAGE_ASSET, PROJECT_HISTORY_LOG_PROJECT_SUBTYPE
from kpi.models import Asset
from kpi.models.import_export_task import (
    AccessLogExportTask,
    ProjectHistoryLogExportTask,
)
from kpi.tests.base_test_case import (
    BaseAccessLogTestCase,
    BaseProjectHistoryLogTestCase,
)
from kpi.tests.utils import baker_generators  # noqa


class LookbackTestMixin:
    def create_plan_for_user(self, user, lookback_days):
        from kobo.apps.stripe.tests.utils import generate_plan_subscription

        product_metadata = {
            'mmo_enabled': 'true',
            'plan_type': 'enterprise',
            'asr_seconds_limit': 1,
            'mt_characters_limit': 1,
            'submission_limit': 1,
            'storage_bytes_limit': 1,
            'log_lookback_days_limit': lookback_days,
        }
        return generate_plan_subscription(user.organization, product_metadata)

    def get_baker_defaults(self):
        return {}

    def get_default_export_task_kwargs(self):
        return {}

    @override_settings(PROJECT_HISTORY_LOG_LIFESPAN=60, ACCESS_LOG_LIFESPAN=60)
    def test_export_respects_lookback_limit(self):
        if settings.STRIPE_ENABLED:
            self.create_plan_for_user(self.user, lookback_days=60)
        today = timezone.now()
        baker_defaults = self.get_baker_defaults()
        out_of_range_date = today - timedelta(days=70)
        baker.make(self.model, date_created=out_of_range_date, **baker_defaults)
        baker.make(self.model, date_created=today, **baker_defaults)
        export_task_kwargs = self.get_default_export_task_kwargs()
        task = self.create_export_task(self.user, **export_task_kwargs)
        task.run()
        with default_storage.open(str(task.result), mode='r') as csv_file:
            reader = csv.DictReader(csv_file)
            rows = list(reader)
        assert len(rows) == 1
        date_created = datetime.strptime(
            rows[0]['date_created'], '%Y-%m-%d %H:%M:%S.%f%z'
        )
        assert date_created == today


class AccessLogExportTaskTests(BaseAccessLogTestCase, LookbackTestMixin):

    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(
            username='testuser', email='testuser@example.com', password='password'
        )
        self.superuser = User.objects.create_superuser(
            username='superuser', email='superuser@example.com', password='password'
        )

    def create_export_task(self, user, get_all_logs=True):
        return AccessLogExportTask.objects.create(
            user=user,
            get_all_logs=get_all_logs,
            data={'type': 'access_logs_export'},
        )

    def get_default_export_task_kwargs(self):
        return {'get_all_logs': False}

    def test_task_initialization(self):
        task = self.create_export_task(self.user, get_all_logs=False)
        self.assertIsInstance(task, AccessLogExportTask)
        self.assertFalse(task.get_all_logs)

    def test_get_all_logs_superuser(self):
        task = self.create_export_task(self.superuser)
        self.assertTrue(task.get_all_logs)

    def test_get_all_logs_non_superuser(self):
        task = self.create_export_task(self.user)

        with self.assertRaises(PermissionError) as context:
            task._run_task([])

        self.assertEqual(
            str(context.exception), 'Only superusers can export all access logs.'
        )

    def test_run_task_creates_csv(self):
        task = self.create_export_task(self.superuser)
        task.run()

        self.assertIsNotNone(task.result, 'The task.result should not be None.')
        # filename should be type-username-date (and sometimes a random 7-char suffix
        # for uniqueness)
        expected_pattern = (
            rf'{self.superuser.username}/exports/access_logs_export-'
            rf'{self.superuser.username}-'
            r'\d{4}-\d{2}-\d{2}T\d{6}Z(_\w{7})?\.csv'
        )

        self.assertRegex(
            task.result.name,
            expected_pattern,
            'The task.result file name format is incorrect.',
        )
        self.assertTrue(
            default_storage.exists(str(task.result)),
            f'The file at {str(task.result)} should exist.',
        )

    def test_csv_content_structure(self):
        log = AccessLog.objects.create(
            user=self.user,
            metadata={
                'auth_type': 'test_auth',
                'source': 'test_source',
                'ip_address': '127.0.0.1',
                'initial_user_username': 'initial_superuser',
                'initial_user_uid': 'initial_superuser_uid',
                'authorized_app_name': 'test_app',
            },
            date_created='2024-11-05T12:00:00Z',
        )
        task = self.create_export_task(self.superuser)
        task.run()

        with default_storage.open(str(task.result), mode='r') as csv_file:
            reader = csv.DictReader(csv_file)
            rows = list(reader)

            expected_headers = [
                'user_url',
                'user_uid',
                'username',
                'auth_type',
                'date_created',
                'source',
                'ip_address',
                'initial_superusername',
                'initial_superuseruid',
                'authorized_application',
                'other_details',
            ]
            self.assertListEqual(expected_headers, reader.fieldnames)

            first_row = rows[0]
            expected_user_url = (
                f'{settings.KOBOFORM_URL}/api/v2/users/{self.user.username}'
            )

            self.assertEqual(first_row['user_url'], expected_user_url)
            self.assertEqual(first_row['user_uid'], log.user_uid)
            self.assertEqual(first_row['username'], self.user.username)
            self.assertEqual(first_row['auth_type'], 'test_auth')
            self.assertEqual(first_row['source'], 'test_source')
            self.assertEqual(first_row['ip_address'], '127.0.0.1')
            self.assertEqual(first_row['initial_superusername'], 'initial_superuser')
            self.assertEqual(first_row['initial_superuseruid'], 'initial_superuser_uid')
            self.assertEqual(first_row['authorized_application'], 'test_app')
            self.assertIsNotNone(first_row['other_details'])

    def tearDown(self):
        AccessLogExportTask.objects.all().delete()
        User.objects.all().delete()


class ProjectHistoryLogExportTaskTests(
    BaseProjectHistoryLogTestCase, LookbackTestMixin
):

    def create_export_task(self, user, asset_uid=None):
        return ProjectHistoryLogExportTask.objects.create(
            user=user,
            asset_uid=asset_uid,
            data={'type': 'project_history_logs_export'},
        )

    def get_default_export_task_kwargs(self):
        return {'asset_uid': Asset.objects.get(id=1).uid}

    def test_run_task_creates_csv(self):
        user = User.objects.get(username='adminuser')
        task = self.create_export_task(user)
        task.run()

        self.assertIsNotNone(task.result, 'The task.result should not be None.')
        # filename should be type-username-date (and sometimes a random 7-char suffix
        # for uniqueness)
        expected_pattern = (
            r'adminuser/exports/project_history_logs_export-'
            r'adminuser-'
            r'\d{4}-\d{2}-\d{2}T\d{6}Z(_\w{7})?\.csv'
        )

        self.assertRegex(
            task.result.name,
            expected_pattern,
            'The task.result file name format is incorrect.',
        )
        self.assertTrue(
            default_storage.exists(str(task.result)),
            f'The file at {str(task.result)} should exist.',
        )

    def test_csv_content_structure(self):
        asset = Asset.objects.get(id=1)
        user = User.objects.get(username='someuser')
        asset.assign_perm(user_obj=user, perm=PERM_MANAGE_ASSET)
        log = ProjectHistoryLog.objects.create(
            user=user,
            metadata={
                'asset_uid': asset.uid,
                'source': 'test_source',
                'ip_address': '127.0.0.1',
                'log_subtype': PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
                'submission': {
                    'submitted_by': 'Fred',
                },
                'project_owner': 'someuser',
            },
            date_created='2024-11-05T12:00:00Z',
            action=AuditAction.ADD_SUBMISSION,
            object_id=asset.id,
        )
        task = self.create_export_task(user, asset.uid)
        task.run()

        with default_storage.open(str(task.result), mode='r') as csv_file:
            reader = csv.DictReader(csv_file)
            rows = list(reader)

            expected_headers = [
                'user_url',
                'user_uid',
                'username',
                'action',
                'date_created',
                'source',
                'ip_address',
                'asset_uid',
                'other_details',
            ]
            self.assertListEqual(expected_headers, reader.fieldnames)

            first_row = rows[0]
            expected_user_url = f'{settings.KOBOFORM_URL}/api/v2/users/someuser'

            self.assertEqual(first_row['user_url'], expected_user_url)
            self.assertEqual(first_row['user_uid'], log.user_uid)
            self.assertEqual(first_row['username'], 'someuser')
            self.assertEqual(first_row['action'], AuditAction.ADD_SUBMISSION)
            self.assertEqual(first_row['source'], 'test_source')
            self.assertEqual(first_row['ip_address'], '127.0.0.1')
            self.assertIsNotNone(first_row['other_details'])

    def test_export_for_single_asset(self):
        asset = Asset.objects.get(id=1)
        adminuser = User.objects.get(username='adminuser')
        ProjectHistoryLog.objects.create(
            user=User.objects.get(username='someuser'),
            action=AuditAction.ADD_SUBMISSION,
            metadata={
                'source': 'source',
                'ip_address': '12345',
                'asset_uid': asset.uid,
                'log_subtype': 'project',
                'project_owner': 'someuser',
            },
            object_id=asset.id,
        )
        # use a different action to make it easy to identify
        ProjectHistoryLog.objects.create(
            user=User.objects.get(username='someuser'),
            action=AuditAction.MODIFY_SUBMISSION,
            metadata={
                'source': 'source',
                'ip_address': '12345',
                'asset_uid': 'fakeuid',
                'log_subtype': 'project',
                'project_owner': 'someuser',
            },
            object_id=2,
        )
        task = self.create_export_task(user=adminuser, asset_uid=asset.uid)
        task.run()
        with default_storage.open(str(task.result), mode='r') as csv_file:
            reader = csv.DictReader(csv_file)
            rows = list(reader)
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]['action'], AuditAction.ADD_SUBMISSION)

    def test_export_all(self):
        asset = Asset.objects.get(id=1)
        adminuser = User.objects.get(username='adminuser')
        ProjectHistoryLog.objects.create(
            user=User.objects.get(username='someuser'),
            action=AuditAction.ADD_SUBMISSION,
            metadata={
                'source': 'source',
                'ip_address': '12345',
                'asset_uid': asset.uid,
                'log_subtype': 'project',
                'project_owner': 'someuser',
            },
            object_id=asset.id,
        )
        # use a different action to make it easy to identify
        ProjectHistoryLog.objects.create(
            user=User.objects.get(username='someuser'),
            action=AuditAction.MODIFY_SUBMISSION,
            metadata={
                'source': 'source',
                'ip_address': '12345',
                'asset_uid': 'fakeuid',
                'log_subtype': 'project',
                'project_owner': 'someuser',
            },
            object_id=2,
        )
        task = self.create_export_task(user=adminuser)
        task.run()
        with default_storage.open(str(task.result), mode='r') as csv_file:
            reader = csv.DictReader(csv_file)
            rows = list(reader)
            self.assertEqual(len(rows), 2)
            self.assertEqual(rows[0]['action'], AuditAction.MODIFY_SUBMISSION)
            self.assertEqual(rows[1]['action'], AuditAction.ADD_SUBMISSION)

    def test_non_superuser_cannot_export_all(self):
        task = self.create_export_task(user=User.objects.get(username='someuser'))
        with self.assertRaises(PermissionError) as context:
            task._run_task([])
        self.assertEqual(
            str(context.exception),
            'Only superusers can export all project history logs.',
        )

    def test_user_must_have_manage_asset_permission(self):
        anotheruser = User.objects.get(username='anotheruser')
        asset = Asset.objects.get(id=1)
        asset.remove_perm(user_obj=anotheruser, perm=PERM_MANAGE_ASSET)
        task = self.create_export_task(anotheruser, asset_uid=asset.uid)
        with self.assertRaises(PermissionError) as context:
            task._run_task([])
        self.assertEqual(
            str(context.exception),
            'User does not have permission to export logs for this asset.',
        )
