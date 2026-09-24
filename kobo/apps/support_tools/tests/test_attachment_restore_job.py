from unittest.mock import MagicMock, patch

from celery.exceptions import SoftTimeLimitExceeded
from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.utils.attachment_restore import (
    ProjectAlreadyBeingRestoredError,
    get_lock_cache_key,
)
from kobo.apps.support_tools.models import (
    AttachmentRestoreJob,
    AttachmentRestoreJobStatus,
)
from kobo.apps.support_tools.tasks import run_attachment_restore_job

ASSET_UID = 'aGAcvhamUDuDTtbkyeikbD'


class AttachmentRestoreJobTestCase(TestCase):
    """
    What launching the attachment restore from the admin records and queues.

    The rule deciding which files come back is covered where it lives, in
    `kobo.apps.openrosa.apps.logger.tests.test_attachment_restore`. What is
    checked here is the row: what it asks for, and what the run writes back.
    """

    fixtures = ['test_data']

    def setUp(self):
        self.user = User.objects.get(username='adminuser')
        self.client.force_login(self.user)
        self.addCleanup(cache.delete, get_lock_cache_key(ASSET_UID))

    def test_a_launch_records_what_was_asked_and_queues_it(self):
        with patch(
            'kobo.apps.support_tools.admin.run_attachment_restore_job.delay'
        ) as delay:
            with self.captureOnCommitCallbacks(execute=True):
                response = self._add(dry_run=False)

        assert response.status_code == 302

        job = AttachmentRestoreJob.objects.get()
        assert job.asset_uid == ASSET_UID
        assert job.dry_run is False
        assert job.created_by == self.user
        assert job.status == AttachmentRestoreJobStatus.PENDING
        delay.assert_called_once_with(job.pk)

    def test_a_launch_reports_only_unless_it_is_asked_to_write(self):
        """
        Writing nothing is the default here as it is in the command, which
        spells the same thing `--no-dry-run`.
        """

        with patch('kobo.apps.support_tools.admin.run_attachment_restore_job.delay'):
            with self.captureOnCommitCallbacks(execute=True):
                self._add()

        assert AttachmentRestoreJob.objects.get().dry_run is True

    def test_a_project_that_cannot_be_resolved_is_refused(self):
        """
        A typo has to be caught while somebody is still looking at it, rather
        than fail in a worker nobody watches.
        """

        with patch(
            'kobo.apps.support_tools.admin.run_attachment_restore_job.delay'
        ) as delay:
            response = self._add(
                asset_uid='aNoSuchAsset',
                resolve_error='Asset `aNoSuchAsset` does not exist',
            )

        assert response.status_code == 200
        assert 'does not exist' in response.content.decode()
        assert not AttachmentRestoreJob.objects.exists()
        delay.assert_not_called()

    def test_a_project_a_run_already_has_is_refused(self):
        cache.set(get_lock_cache_key(ASSET_UID), 'held', timeout=60)

        with patch(
            'kobo.apps.support_tools.admin.run_attachment_restore_job.delay'
        ) as delay:
            response = self._add()

        assert 'A run already has this project' in response.content.decode()
        assert not AttachmentRestoreJob.objects.exists()
        delay.assert_not_called()

    def test_a_row_that_stopped_short_is_run_again_as_it_is(self):
        """
        A run cut short leaves nothing behind but its row, and picks up where
        the project stopped, so relaunching it must not mean typing it in anew.
        """

        job = self._job(status=AttachmentRestoreJobStatus.IN_PROGRESS)

        with patch(
            'kobo.apps.support_tools.admin.run_attachment_restore_job.delay'
        ) as delay:
            with self.captureOnCommitCallbacks(execute=True):
                response = self._run_again(job)

        assert response.status_code == 302
        delay.assert_called_once_with(job.pk)

        job.refresh_from_db()
        assert job.status == AttachmentRestoreJobStatus.PENDING

    def test_a_row_whose_project_is_still_held_is_not_run_again(self):
        job = self._job(status=AttachmentRestoreJobStatus.IN_PROGRESS)
        cache.set(get_lock_cache_key(ASSET_UID), 'held', timeout=60)

        with patch(
            'kobo.apps.support_tools.admin.run_attachment_restore_job.delay'
        ) as delay:
            with self.captureOnCommitCallbacks(execute=True):
                self._run_again(job)

        delay.assert_not_called()

        job.refresh_from_db()
        assert job.status == AttachmentRestoreJobStatus.IN_PROGRESS

    def test_a_row_already_waiting_is_not_queued_twice(self):
        """
        Two people hitting the action at once would otherwise queue two tasks
        for one row, and the task turned away at the lock would write the row
        back over what the other one did.
        """

        job = self._job(status=AttachmentRestoreJobStatus.PENDING)

        with patch(
            'kobo.apps.support_tools.admin.run_attachment_restore_job.delay'
        ) as delay:
            with self.captureOnCommitCallbacks(execute=True):
                self._run_again(job)

        delay.assert_not_called()

    def test_a_run_writes_its_log_and_its_counts_back(self):
        job = self._job()

        self._run(job, lines=['Done. 4 scanned, 2 restored.'], scanned=4, restored=2)

        job.refresh_from_db()
        assert job.status == AttachmentRestoreJobStatus.COMPLETED
        assert job.log == 'Done. 4 scanned, 2 restored.'
        assert (job.scanned, job.restored) == (4, 2)

    def test_a_later_run_adds_to_what_the_first_one_reported(self):
        """
        A row outlives the task that serves it, since a run cut short by the
        time limit re-queues itself. Its log has to grow rather than start over.
        """

        job = self._job()
        self._run(job, lines=['First half'])
        self._run(job, lines=['Second half'], scanned=2, restored=1)

        job.refresh_from_db()
        assert job.log == 'First half\nSecond half'
        assert (job.scanned, job.restored) == (2, 1)

    def test_the_time_limit_leaves_the_row_in_progress_and_re_queues_it(self):
        job = self._job()

        with patch.object(run_attachment_restore_job, 'delay') as delay:
            self._run(job, lines=['First half'], raises=SoftTimeLimitExceeded)

        job.refresh_from_db()
        assert job.status == AttachmentRestoreJobStatus.IN_PROGRESS
        assert 'has been re-queued' in job.log
        delay.assert_called_once_with(job.pk)

    def test_the_replacement_is_queued_only_once_this_run_is_written_down(self):
        """
        The restorer lets the project go while the time limit propagates, so a
        replacement can start at once. Queued any earlier, the two would write
        the same row from copies neither has reread, and whichever saved last
        would drop the other's log and counts.
        """

        job = self._job()
        seen = {}

        def read_the_row(job_id):
            seen.update(
                AttachmentRestoreJob.objects.filter(pk=job_id)
                .values('status', 'log', 'scanned')
                .first()
            )

        with patch.object(run_attachment_restore_job, 'delay', read_the_row):
            self._run(
                job, lines=['First half'], scanned=7, raises=SoftTimeLimitExceeded
            )

        assert seen['status'] == AttachmentRestoreJobStatus.IN_PROGRESS
        assert 'First half' in seen['log']
        assert seen['scanned'] == 7

    def test_a_project_somebody_else_holds_leaves_the_row_unfinished(self):
        """
        A run turned away at the lock did no work, so the row must not claim a
        completion. It stays in progress, which the admin shows as interrupted
        once the other run lets the project go.
        """

        job = self._job()

        self._run(
            job, raises=ProjectAlreadyBeingRestoredError('Another run already has it')
        )

        job.refresh_from_db()
        assert job.status == AttachmentRestoreJobStatus.IN_PROGRESS
        assert 'Another run already has it' in job.log

    def test_a_run_that_blew_up_says_so_on_the_row(self):
        job = self._job()

        with self.assertRaises(OSError):
            self._run(job, raises=OSError('mongo is down'))

        job.refresh_from_db()
        assert job.status == AttachmentRestoreJobStatus.FAILED
        assert 'FAILED. OSError: mongo is down' in job.log

    def test_a_run_killed_outright_is_shown_as_interrupted(self):
        """
        An OOM or a pod eviction never gets to close the row. Only the lock
        expires on its own, so that is what the admin asks.
        """

        from kobo.apps.support_tools.admin import AttachmentRestoreJobAdmin

        job = self._job(status=AttachmentRestoreJobStatus.IN_PROGRESS)
        state = AttachmentRestoreJobAdmin.state

        cache.set(get_lock_cache_key(ASSET_UID), 'held', timeout=60)
        assert state(None, job) == 'in progress'

        cache.delete(get_lock_cache_key(ASSET_UID))
        assert state(None, job) == 'interrupted'

    def _add(
        self,
        asset_uid: str = ASSET_UID,
        dry_run: bool = True,
        resolve_error: str = None,
    ):
        """
        Fill the admin's add form in, which is what queues a run.

        The project is resolved against KPI, which these tests stand in for,
        `resolve_error` being what that lookup refuses with.
        """

        data = {'asset_uid': asset_uid, 'resume': 'on'}

        if dry_run:
            data['dry_run'] = 'on'

        with patch(
            'kobo.apps.support_tools.admin.get_project_xform',
            side_effect=ValueError(resolve_error) if resolve_error else None,
        ):
            return self.client.post(
                reverse('admin:support_tools_attachmentrestorejob_add'), data
            )

    def _job(self, **kwargs) -> AttachmentRestoreJob:
        return AttachmentRestoreJob.objects.create(
            asset_uid=ASSET_UID, created_by=self.user, **kwargs
        )

    def _run_again(self, job: AttachmentRestoreJob):
        """
        Pick the row in the changelist and launch the action on it.
        """

        return self.client.post(
            reverse('admin:support_tools_attachmentrestorejob_changelist'),
            {'action': 'run_again', '_selected_action': [job.pk], 'index': 0},
        )

    def _run(
        self,
        job: AttachmentRestoreJob,
        lines: list = None,
        scanned: int = 0,
        restored: int = 0,
        raises: Exception = None,
    ):
        """
        Run the task against a restorer that reports what the test asks for,
        the rule it replays being covered by its own tests.
        """

        def restorer(xform, dry_run, resume, log):
            fake = MagicMock(scanned=scanned, restored=restored)

            def run():
                for line in lines or []:
                    log(line)
                if raises:
                    raise raises

            fake.run = run

            return fake

        with patch('kobo.apps.support_tools.tasks.get_project_xform'):
            with patch(
                'kobo.apps.support_tools.tasks.AttachmentRestorer',
                side_effect=restorer,
            ):
                run_attachment_restore_job(job.pk)
