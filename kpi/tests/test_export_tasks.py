import datetime
from unittest.mock import Mock, patch

from django.core.exceptions import ObjectDoesNotExist
from django.test import TestCase

from kobo.apps.kobo_auth.shortcuts import User
from kpi.models.import_export_task import ProjectViewExportTask
from kpi.tasks import export_task_in_background


class ExportTaskInBackgroundTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(username='someuser', email='test@example.com')
        self.mock_data = {"type": "assets", "view": "summary"}
        self.task = ProjectViewExportTask.objects.create(
            uid="test_uid", data=self.mock_data, user=self.user
        )
        self.project_view = Mock()
        self.project_view.get_countries.return_value = []

    @patch("django.core.mail.send_mail")
    @patch("kobo.apps.project_views.models.project_view.ProjectView.objects.get")
    def test_export_task_success(self, mock_get_project_view, mock_send_mail):
        mock_get_project_view.return_value = self.project_view
        self.task.run = Mock(return_value=self.task)

        export_task_in_background(
            self.task.uid, self.user.username, ProjectViewExportTask
        )

        self.task.refresh_from_db()
        self.assertEqual(self.task.status, "complete")

        mock_send_mail.assert_called_once()
        args, kwargs = mock_send_mail.call_args
        expected_message = (
            f"Hello {self.user.username},\n\n"
            f"Your report is complete: "
            f"http://kf.kobo.local:8080/private-media/{self.user.username}/exports/"
            f"assets-{self.user.username}-view_summary-"
            f"{datetime.datetime.now().strftime('%Y-%m-%dT%H%M%SZ')}.csv\n\n"
            f"Regards,\n"
            f"KoboToolbox"
        )
        self.assertEqual(kwargs["subject"], "Project View Report Complete")
        self.assertEqual(expected_message, kwargs["message"])

    @patch("django.core.mail.send_mail")
    @patch("kobo.apps.project_views.models.project_view.ProjectView.objects.get")
    def test_invalid_export_task_uid(self, mock_get_project_view, mock_send_mail):
        mock_get_project_view.side_effect = ObjectDoesNotExist
        with self.assertRaisesMessage(
            ObjectDoesNotExist, "ProjectViewExportTask matching query does not exist."
        ):
            export_task_in_background(
                "invalid_uid", self.user.username, ProjectViewExportTask
            )

        mock_send_mail.assert_not_called()

    @patch("django.core.mail.send_mail")
    @patch("kobo.apps.project_views.models.project_view.ProjectView.objects.get")
    def test_invalid_username(self, mock_get_project_view, mock_send_mail):
        with self.assertRaisesMessage(
            ObjectDoesNotExist, "User matching query does not exist."
        ):
            export_task_in_background(
                self.task.uid, "invalid_username", ProjectViewExportTask
            )

        mock_send_mail.assert_not_called()

    @patch("django.core.mail.send_mail")
    @patch("kobo.apps.project_views.models.project_view.ProjectView.objects.get")
    @patch("kpi.models.ProjectViewExportTask._run_task")
    def test_export_task_error(
        self, mock_run_task, mock_get_project_view, mock_send_mail
    ):
        mock_get_project_view.return_value = self.project_view
        mock_run_task.side_effect = Exception("Simulated task failure")

        export_task_in_background(
            self.task.uid, self.user.username, ProjectViewExportTask
        )

        self.task.refresh_from_db()
        self.assertEqual(self.task.status, "error")

    @patch("django.core.mail.send_mail")
    @patch("kobo.apps.project_views.models.project_view.ProjectView.objects.get")
    @patch("kpi.models.ProjectViewExportTask._run_task")
    def test_email_not_sent_if_export_errors(
        self, mock_run_task, mock_get_project_view, mock_send_mail
    ):
        mock_get_project_view.return_value = self.project_view
        mock_run_task.side_effect = Exception("Simulated task failure")

        export_task_in_background(
            self.task.uid, self.user.username, ProjectViewExportTask
        )

        mock_send_mail.assert_not_called()
