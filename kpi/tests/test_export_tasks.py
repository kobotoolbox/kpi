import threading
from datetime import timedelta
from unittest.mock import Mock, patch

from constance.test import override_config
from ddt import data, ddt, unpack
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from kobo.apps.audit_log.tasks import (
    cleanup_access_log_exports,
    cleanup_project_history_log_exports,
)
from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.project_views.tasks import cleanup_project_view_exports
from kpi.constants import ASSET_TYPE_SURVEY
from kpi.models import Asset, AssetExportSettings
from kpi.models.import_export_task import (
    AccessLogExportTask,
    ImportExportStatusChoices,
    ProjectHistoryLogExportTask,
    ProjectViewExportTask,
    SubmissionExportTask,
    SubmissionSynchronousExport,
)
from kpi.tasks import (
    cleanup_anonymous_exports,
    cleanup_synchronous_exports,
    export_task_in_background,
)
from kpi.utils.object_permission import get_anonymous_user


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


def to_snake(name: str) -> str:
    """Convert a CamelCase class name to snake_case."""
    out = []
    for c in name:
        if c.isupper() and out:
            out.append('_')
        out.append(c.lower())
    return ''.join(out)


@ddt
@override_config(EXPORT_RETENTION=30)
@override_config(SYNCHRONOUS_EXPORT_CACHE_MAX_AGE=30)
class ExportCleanupTestCase(TransactionTestCase):
    """
    Single test class covering ALL export cleanup behaviours.

    - A single @data() block lists all (model, cleanup_function) pairs.
    - The same test logic applies to all export models.
    - Export creation is dispatched dynamically through:
         _create_export_<snake_case_model_name>()
    """

    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='someuser')

    # List of (Model, cleanup_task) tuples used by all tests
    CASES = [
        (SubmissionExportTask, cleanup_anonymous_exports),
        (SubmissionSynchronousExport, cleanup_synchronous_exports),
        (AccessLogExportTask, cleanup_access_log_exports),
        (ProjectHistoryLogExportTask, cleanup_project_history_log_exports),
        (ProjectViewExportTask, cleanup_project_view_exports),
    ]

    # ======================================================================
    # Generic tests applying to ALL export types
    # ======================================================================

    @data(*CASES)
    @unpack
    def test_exports_older_than_grace_period_are_deleted(self, model, cleanup_task):
        """
        Exports older than EXPORT_RETENTION should be deleted.
        """

        old_export = self._create_export(model=model, minutes_old=31)
        recent_export = self._create_export(model=model, minutes_old=29)

        cleanup_task()

        self.assertFalse(model.objects.filter(pk=old_export.pk).exists())
        self.assertTrue(model.objects.filter(pk=recent_export.pk).exists())

    @data(*CASES)
    @unpack
    def test_processing_exports_not_deleted(self, model, cleanup_task):
        """
        Exports with status PROCESSING must never be deleted.
        """

        processing_export = self._create_export(
            model=model,
            minutes_old=120,
            status=ImportExportStatusChoices.PROCESSING,
        )

        cleanup_task()

        self.assertTrue(model.objects.filter(pk=processing_export.pk).exists())

    @data(*CASES)
    @unpack
    def test_processing_time_respected(self, model, cleanup_task):
        """
        Exports with a long processing_time_seconds should not be deleted
        if the effective threshold is not reached.
        """

        old_export = self._create_export(
            model=model, minutes_old=45, processing_time_seconds=600
        )
        recent_export = self._create_export(
            model=model, minutes_old=35, processing_time_seconds=600
        )

        cleanup_task()

        self.assertFalse(model.objects.filter(pk=old_export.pk).exists())
        self.assertTrue(model.objects.filter(pk=recent_export.pk).exists())

    @data(*CASES)
    @unpack
    def test_concurrency_skips_locked_rows(self, model, cleanup_task):
        """
        If a row is locked by another transaction, cleanup must skip it and
        still delete other expired rows.
        """

        exports = [self._create_export(model=model, minutes_old=120) for _ in range(5)]
        locked_export = exports[0]
        unlocked_exports = exports[1:]

        lock_acquired = threading.Event()
        release_lock = threading.Event()

        def acquire_lock():
            with transaction.atomic():
                model.objects.select_for_update().get(pk=locked_export.pk)
                lock_acquired.set()
                release_lock.wait()

        t = threading.Thread(target=acquire_lock)
        t.start()
        lock_acquired.wait()

        cleanup_task()

        release_lock.set()
        t.join()

        self.assertTrue(model.objects.filter(pk=locked_export.pk).exists())
        self.assertFalse(
            model.objects.filter(pk__in=[e.pk for e in unlocked_exports]).exists()
        )

    @override_config(EXPORT_RETENTION=5)
    @override_config(SYNCHRONOUS_EXPORT_CACHE_MAX_AGE=600)
    def test_synchronous_export_cleanup_respects_cache_age(self):
        """
        Verify that synchronous exports are kept as long as they remain within
        SYNCHRONOUS_EXPORT_CACHE_MAX_AGE, even if they exceed
        EXPORT_RETENTION.

        Once older than the cache max age, they must be deleted.
        """

        old_export = self._create_export(
            model=SubmissionSynchronousExport,
            minutes_old=31,
        )

        cleanup_synchronous_exports()

        self.assertTrue(
            SubmissionSynchronousExport.objects.filter(pk=old_export.pk).exists()
        )

        old_export.delete()
        old_export = self._create_export(
            model=SubmissionSynchronousExport,
            minutes_old=601,
        )

        cleanup_synchronous_exports()

        self.assertFalse(
            SubmissionSynchronousExport.objects.filter(pk=old_export.pk).exists()
        )

    def _create_export(self, model, **kwargs):
        """
        Dynamically call the right export creation method based on the model name.
        Example:
            SubmissionExportTask → _create_export_submission_export_task()
        """

        method_name = f'_create_export_{to_snake(model.__name__)}'
        if not hasattr(self, method_name):
            raise NotImplementedError(f'{method_name}() is not implemented')
        export = getattr(self, method_name)(
            status=kwargs.get('status', ImportExportStatusChoices.COMPLETE),
            processing_time_seconds=kwargs.get('processing_time_seconds', 60),
        )

        minutes_old = kwargs.get('minutes_old', 0)
        if minutes_old and minutes_old > 0:
            past = timezone.now() - timedelta(minutes=minutes_old)
            model.objects.filter(pk=export.pk).update(date_created=past)
            export.refresh_from_db()

        return export

    # ======================================================================
    # Model-specific export creation methods
    # ======================================================================

    def _create_export_submission_export_task(
        self, status: str, processing_time_seconds: int
    ):
        """
        Build a SubmissionExportTask for anonymous exports
        """

        return SubmissionExportTask.objects.create(
            user=get_anonymous_user(),
            status=status,
            data={
                'type': 'xls',
                'source': 'http://testserver/api/v2/assets/a1234bced/',
                'processing_time_seconds': processing_time_seconds,
            },
        )

    def _create_export_submission_synchronous_export(
        self, status: str, processing_time_seconds: int
    ):
        """
        Build a SubmissionSynchronousExport with asset + settings
        """

        asset = Asset.objects.create(
            owner=self.user, asset_type=ASSET_TYPE_SURVEY, name='Sync'
        )
        asset.deploy(backend='mock', active=True)
        export_settings = AssetExportSettings.objects.create(
            asset=asset,
            name='Simple XLS',
            export_settings={'type': 'xls'},
        )
        return SubmissionSynchronousExport.objects.create(
            user=self.user,
            asset_export_settings=export_settings,
            status=status,
            data={
                'type': 'xls',
                'source': 'http://testserver/api/v2/assets/a1234bced/',
                'processing_time_seconds': processing_time_seconds,
            },
        )

    def _create_export_access_log_export_task(
        self, status: str, processing_time_seconds: int
    ):
        """
        Build an AccessLogExportTask.
        """

        return AccessLogExportTask.objects.create(
            user=self.user,
            status=status,
            data={
                'type': 'access_log_export',
                'processing_time_seconds': processing_time_seconds,
            },
        )

    def _create_export_project_history_log_export_task(
        self, status: str, processing_time_seconds: int
    ):
        """
        Build a ProjectHistoryLogExportTask.
        """

        return ProjectHistoryLogExportTask.objects.create(
            user=self.user,
            status=status,
            data={
                'type': 'project_history_log_export',
                'source': 'http://testserver/api/v2/assets/a1234bced/',
                'processing_time_seconds': processing_time_seconds,
            },
        )

    def _create_export_project_view_export_task(
        self, status: str, processing_time_seconds: int
    ):
        """
        Build a ProjectViewExportTask
        """

        return ProjectViewExportTask.objects.create(
            user=self.user,
            status=status,
            data={
                'type': 'assets',
                'view': 'pvNNUan8EBhzfkrv6sCNuzR',
                'processing_time_seconds': processing_time_seconds,
            },
        )
