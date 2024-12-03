import csv
import os

from django.conf import settings
from django.test import TestCase

from kobo.apps.audit_log.models import AccessLog
from kobo.apps.kobo_auth.shortcuts import User
from kpi.models.import_export_task import AccessLogExportTask


class AccessLogExportTaskTests(TestCase):

    def setUp(self):
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
        expected_pattern = (
            rf'{self.superuser.username}/exports/access_logs_export-'
            rf'{self.superuser.username}-'
            r'\d{4}-\d{2}-\d{2}T\d{6}Z\.csv'
        )

        self.assertRegex(
            task.result.name,
            expected_pattern,
            'The task.result file name format is incorrect.',
        )
        self.assertTrue(
            os.path.exists(task.result.path),
            f'The file at {task.result.path} should exist.',
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

        with open(task.result.path, mode='r', encoding='utf-8') as csv_file:
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
