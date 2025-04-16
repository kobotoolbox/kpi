from unittest.mock import Mock, patch

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kpi.models.import_export_task import ProjectViewExportTask
from kpi.tasks import export_task_in_background


@patch('django.core.mail.send_mail')
@patch('kobo.apps.project_views.models.project_view.ProjectView.objects.get')
class ExportTaskInBackgroundTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(username='someuser', email='test@example.com')
        self.mock_data = {'type': 'assets', 'view': 'summary'}
        self.task = ProjectViewExportTask.objects.create(
            uid='test_uid', data=self.mock_data, user=self.user
        )
        self.project_view = Mock()
        self.project_view.get_countries.return_value = []

    def test_export_task_success(self, mock_get_project_view, mock_send_mail):
        mock_get_project_view.return_value = self.project_view
        self.task.run = Mock(return_value=self.task)

        export_task_in_background(
            self.task.uid, self.user.username, 'kpi.ProjectViewExportTask'
        )

        self.task.refresh_from_db()
        self.assertEqual(self.task.status, 'complete')

        root_url = settings.KOBOFORM_URL
        expected_file_path = self.task.result.url
        expected_message = (
            'Hello {},\n\n' 'Your report is complete: {}\n\n' 'Regards,\n' 'KoboToolbox'
        ).format(
            self.user.username,
            f'{root_url}{expected_file_path}',
        )
        mock_send_mail.assert_called_once_with(
            subject='Project View Report Complete',
            message=expected_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=['test@example.com'],
            fail_silently=False,
        )

    def test_invalid_export_task_uid(self, mock_get_project_view, mock_send_mail):
        mock_get_project_view.side_effect = ObjectDoesNotExist
        with self.assertRaisesMessage(
            ObjectDoesNotExist, 'ProjectViewExportTask matching query does not exist.'
        ):
            export_task_in_background(
                'invalid_uid', self.user.username, 'kpi.ProjectViewExportTask'
            )

        mock_send_mail.assert_not_called()

    def test_invalid_username(self, mock_get_project_view, mock_send_mail):
        with self.assertRaisesMessage(
            ObjectDoesNotExist, 'User matching query does not exist.'
        ):
            export_task_in_background(
                self.task.uid, 'invalid_username', 'kpi.ProjectViewExportTask'
            )

        mock_send_mail.assert_not_called()

    @patch('kpi.models.ProjectViewExportTask._run_task')
    def test_export_task_error(
        self, mock_run_task, mock_get_project_view, mock_send_mail
    ):
        mock_get_project_view.return_value = self.project_view
        mock_run_task.side_effect = Exception('Simulated task failure')

        export_task_in_background(
            self.task.uid, self.user.username, 'kpi.ProjectViewExportTask'
        )

        self.task.refresh_from_db()
        self.assertEqual(self.task.status, 'error')

    @patch('kpi.models.ProjectViewExportTask._run_task')
    def test_email_not_sent_if_export_errors(
        self, mock_run_task, mock_get_project_view, mock_send_mail
    ):
        mock_get_project_view.return_value = self.project_view
        mock_run_task.side_effect = Exception('Simulated task failure')

        export_task_in_background(
            self.task.uid, self.user.username, 'kpi.ProjectViewExportTask'
        )

        mock_send_mail.assert_not_called()
