from unittest.mock import MagicMock, patch

from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.support_tools.models import (
    AttachmentRestoreJob,
    FormVersionsRestoreJob,
    RestoreJobStatus,
)
from kobo.apps.support_tools.tasks import run_form_versions_restore_job
from kobo.apps.support_tools.utils.restorers.form_versions import (
    FormVersionsRestorer,
)

ASSET_UID = 'aGAcvhamUDuDTtbkyeikbD'


class FormVersionsRestoreJobTestCase(TestCase):
    """
    What launching the form versions restore from the admin records and
    queues.

    What every restore row shares, re-queueing on the time limit, a project
    somebody else holds, a run that blew up, is covered once, in
    `kobo.apps.support_tools.tests.test_attachment_restore_job`. What is
    checked here is what this row adds: its own task, its own lock, its own
    count, and the attachment restore it may chain.
    """

    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='adminuser')
        self.client.force_login(self.user)
        self.addCleanup(
            cache.delete, FormVersionsRestorer.get_lock_cache_key(ASSET_UID)
        )

    def test_a_launch_records_what_was_asked_and_queues_it(self):
        with patch(
            'kobo.apps.support_tools.admin.run_form_versions_restore_job.delay'
        ) as delay:
            with self.captureOnCommitCallbacks(execute=True):
                response = self._add(dry_run=False, restore_attachments=True)

        assert response.status_code == 302

        job = FormVersionsRestoreJob.objects.get()
        assert job.asset_uid == ASSET_UID
        assert job.dry_run is False
        assert job.restore_attachments is True
        assert job.created_by == self.user
        assert job.status == RestoreJobStatus.PENDING
        delay.assert_called_once_with(job.pk)

    def test_a_launch_reports_only_and_chains_nothing_by_default(self):
        with patch('kobo.apps.support_tools.admin.run_form_versions_restore_job.delay'):
            with self.captureOnCommitCallbacks(execute=True):
                self._add()

        job = FormVersionsRestoreJob.objects.get()
        assert job.dry_run is True
        assert job.restore_attachments is False

    def test_a_project_a_run_already_has_is_refused(self):
        cache.set(FormVersionsRestorer.get_lock_cache_key(ASSET_UID), 'held', 60)

        with patch(
            'kobo.apps.support_tools.admin.run_form_versions_restore_job.delay'
        ) as delay:
            response = self._add()

        assert 'A run already has this project' in response.content.decode()
        assert not FormVersionsRestoreJob.objects.exists()
        delay.assert_not_called()

    def test_a_row_that_stopped_short_is_run_again_as_it_is(self):
        job = self._job(status=RestoreJobStatus.IN_PROGRESS)

        with patch(
            'kobo.apps.support_tools.admin.run_form_versions_restore_job.delay'
        ) as delay:
            with self.captureOnCommitCallbacks(execute=True):
                self.client.post(
                    reverse('admin:support_tools_formversionsrestorejob_changelist'),
                    {'action': 'run_again', '_selected_action': [job.pk], 'index': 0},
                )

        delay.assert_called_once_with(job.pk, resume=True)

        job.refresh_from_db()
        assert job.status == RestoreJobStatus.PENDING

    def test_a_run_writes_its_log_and_its_counts_back(self):
        job = self._job()

        self._run(job, lines=['Done.'], scanned=4, updated=2)

        job.refresh_from_db()
        assert job.status == RestoreJobStatus.COMPLETED
        assert job.log == 'Done.'
        assert (job.scanned, job.updated) == (4, 2)

    def test_a_completed_run_chains_the_attachment_restore_in_its_mode(self):
        """
        From the start, whatever the row asked: a cursor an earlier attachment
        run left behind was placed before the versions were recorded, and
        would skip the files they now account for.
        """

        job = self._job(dry_run=False, restore_attachments=True)

        with patch(
            'kobo.apps.support_tools.tasks.run_attachment_restore_job.delay'
        ) as delay:
            self._run(job)

        attachment_job = AttachmentRestoreJob.objects.get()
        assert attachment_job.asset_uid == ASSET_UID
        assert attachment_job.dry_run is False
        assert attachment_job.resume is False
        assert attachment_job.created_by == self.user
        delay.assert_called_once_with(attachment_job.pk)

        job.refresh_from_db()
        assert f'see its row #{attachment_job.pk}' in job.log

    def test_a_dry_run_warns_the_chained_count_may_be_low(self):
        job = self._job(restore_attachments=True)

        with patch('kobo.apps.support_tools.tasks.run_attachment_restore_job.delay'):
            self._run(job)

        assert AttachmentRestoreJob.objects.get().dry_run is True

        job.refresh_from_db()
        assert 'its count may be low' in job.log

    def test_an_unfinished_run_chains_nothing(self):
        """
        Only the run that walks the last submission chains: the attachment
        restore has to see every version recorded.
        """

        job = self._job(restore_attachments=True)

        with patch(
            'kobo.apps.support_tools.tasks.run_attachment_restore_job.delay'
        ) as delay:
            self._run(job, completed=False)

        assert not AttachmentRestoreJob.objects.exists()
        delay.assert_not_called()

    def test_nothing_is_chained_unless_it_was_asked_for(self):
        job = self._job()

        with patch(
            'kobo.apps.support_tools.tasks.run_attachment_restore_job.delay'
        ) as delay:
            self._run(job)

        assert not AttachmentRestoreJob.objects.exists()
        delay.assert_not_called()

    def _add(
        self,
        dry_run: bool = True,
        restore_attachments: bool = False,
    ):
        """
        Fill the admin's add form in, which is what queues a run.
        """

        data = {'asset_uid': ASSET_UID, 'resume': 'on'}

        if dry_run:
            data['dry_run'] = 'on'
        if restore_attachments:
            data['restore_attachments'] = 'on'

        with patch('kobo.apps.support_tools.admin.get_project_xform'):
            return self.client.post(
                reverse('admin:support_tools_formversionsrestorejob_add'), data
            )

    def _job(self, **kwargs) -> FormVersionsRestoreJob:
        return FormVersionsRestoreJob.objects.create(
            asset_uid=ASSET_UID, created_by=self.user, **kwargs
        )

    def _run(
        self,
        job: FormVersionsRestoreJob,
        lines: list = None,
        scanned: int = 0,
        updated: int = 0,
        completed: bool = True,
    ):
        """
        Run the task against a restorer that reports what the test asks for,
        the rule it replays being covered by its own tests.
        """

        def restorer(xform, dry_run, resume, log):
            fake = MagicMock(scanned=scanned, updated=updated, completed=completed)

            def run():
                for line in lines or []:
                    log(line)

            fake.run = run

            return fake

        with patch('kobo.apps.support_tools.tasks.get_project_xform'):
            with patch(
                'kobo.apps.support_tools.tasks.FormVersionsRestorer',
                side_effect=restorer,
            ):
                run_form_versions_restore_job(job.pk)
