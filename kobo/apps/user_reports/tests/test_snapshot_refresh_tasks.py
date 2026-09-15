from contextlib import ExitStack
from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.db.models.signals import post_delete
from django.test import TestCase
from django.utils import timezone
from model_bakery import baker

from kobo.apps.organizations.models import Organization
from kobo.apps.user_reports.models import (
    BillingAndUsageSnapshot,
    BillingAndUsageSnapshotRun,
    BillingAndUsageSnapshotStatus,
)
from kobo.apps.user_reports.tasks import LOCK_KEY, refresh_user_report_snapshots
from kpi.tests.utils import (  # noqa: F401 registers Organization.slug gen
    baker_generators,
)

TASK_UTILS = 'kobo.apps.user_reports.utils.tasks.refresh_user_report_snapshots'


class RefreshUserReportSnapshotsTestCase(TestCase):
    """
    Unit tests for the task orchestration logic in
    `refresh_user_report_snapshots`: the cooldown, the run lock, and how the
    materialized view refresh is triggered.

    The billing/limits/usage computations themselves are already covered in
    `test_user_reports.py`, so they are mocked out here to keep these tests
    focused on the task's control flow.
    """

    def setUp(self):
        cache.clear()
        stack = ExitStack()
        self.addCleanup(stack.close)
        stack.enter_context(
            patch(
                f'{TASK_UTILS}.get_current_billing_period_dates_by_org',
                return_value={},
            )
        )
        stack.enter_context(
            patch(
                f'{TASK_UTILS}.get_organizations_effective_limits',
                return_value={},
            )
        )
        stack.enter_context(
            patch(
                'kobo.apps.user_reports.utils.billing_and_usage_calculator'
                '.BillingAndUsageCalculator.calculate_usage_batch',
                return_value={},
            )
        )

    def test_cooldown_skips_new_cycle_when_last_run_completed_recently(self):
        baker.make(Organization, id='org_abcd1234')
        BillingAndUsageSnapshotRun.objects.create(
            status=BillingAndUsageSnapshotStatus.COMPLETED,
        )

        refresh_user_report_snapshots()

        # No new run was created and the lock was never touched
        assert BillingAndUsageSnapshotRun.objects.count() == 1
        assert cache.get(LOCK_KEY) is None

    def test_cooldown_allows_new_cycle_after_min_interval(self):
        baker.make(Organization, id='org_abcd1234')
        old_run = BillingAndUsageSnapshotRun.objects.create(
            status=BillingAndUsageSnapshotStatus.COMPLETED,
        )
        BillingAndUsageSnapshotRun.objects.filter(pk=old_run.pk).update(
            date_modified=timezone.now() - timedelta(hours=5)
        )

        refresh_user_report_snapshots()

        new_run = BillingAndUsageSnapshotRun.objects.exclude(pk=old_run.pk).first()
        assert new_run is not None
        assert new_run.status == BillingAndUsageSnapshotStatus.COMPLETED

    def test_in_progress_run_resumes_regardless_of_cooldown(self):
        org = baker.make(Organization, id='org_abcd1234')
        # This would normally trigger the cooldown skip on its own...
        BillingAndUsageSnapshotRun.objects.create(
            status=BillingAndUsageSnapshotStatus.COMPLETED,
        )
        # ...but an in-progress run must always be resumed
        in_progress = BillingAndUsageSnapshotRun.objects.create(
            status=BillingAndUsageSnapshotStatus.IN_PROGRESS,
            last_processed_org_id='',
        )

        refresh_user_report_snapshots()

        in_progress.refresh_from_db()
        assert in_progress.status == BillingAndUsageSnapshotStatus.COMPLETED
        assert in_progress.last_processed_org_id == org.id

    def test_lock_prevents_concurrent_execution(self):
        baker.make(Organization, id='org_abcd1234')
        cache.set(LOCK_KEY, 'true', timeout=300)

        refresh_user_report_snapshots()

        assert BillingAndUsageSnapshotRun.objects.count() == 0

    def test_lock_released_after_successful_completion(self):
        baker.make(Organization, id='org_abcd1234')

        refresh_user_report_snapshots()

        assert cache.get(LOCK_KEY) is None
        run = BillingAndUsageSnapshotRun.objects.get()
        assert run.status == BillingAndUsageSnapshotStatus.COMPLETED
        assert run.details['mv_refresh_failed'] is False

    def test_lock_released_and_error_recorded_after_exception(self):
        baker.make(Organization, id='org_abcd1234')

        with patch(
            f'{TASK_UTILS}._process_chunk',
            side_effect=RuntimeError('boom'),
        ):
            refresh_user_report_snapshots()

        assert cache.get(LOCK_KEY) is None
        run = BillingAndUsageSnapshotRun.objects.get()
        assert run.status == BillingAndUsageSnapshotStatus.IN_PROGRESS
        assert run.details['last_error'] == 'boom'

    def test_lock_released_when_run_cannot_be_claimed(self):
        """
        If `get_or_create_run()` itself raises, `run` is never assigned. The
        task must not crash trying to reference it and must still release
        the lock (regression test for a bug introduced by moving
        `get_or_create_run()` inside the `try` block).
        """
        baker.make(Organization, id='org_abcd1234')

        with patch(
            f'{TASK_UTILS}.get_or_create_run',
            side_effect=RuntimeError('db is down'),
        ):
            refresh_user_report_snapshots()

        assert cache.get(LOCK_KEY) is None
        assert BillingAndUsageSnapshotRun.objects.count() == 0

    def test_refresh_materialized_view_called_once_per_run_not_per_chunk(self):
        for i in range(5):
            baker.make(Organization, id=f'org_abcd{i:04d}')

        with patch(f'{TASK_UTILS}.CHUNK_SIZE', 2), patch(
            f'{TASK_UTILS}.refresh_user_reports_materialized_view'
        ) as mock_refresh:
            refresh_user_report_snapshots()

        # 5 orgs processed 2 at a time means 3 chunk iterations, but the view
        # must only be refreshed once, in `finally`, when the invocation ends.
        assert mock_refresh.call_count == 1

    def test_refresh_materialized_view_also_happens_after_an_exception(self):
        baker.make(Organization, id='org_abcd1234')

        with patch(
            f'{TASK_UTILS}._process_chunk',
            side_effect=RuntimeError('boom'),
        ), patch(
            f'{TASK_UTILS}.refresh_user_reports_materialized_view'
        ) as mock_refresh:
            refresh_user_report_snapshots()

        assert mock_refresh.call_count == 1

    def test_lock_still_released_when_refresh_itself_fails(self):
        baker.make(Organization, id='org_abcd1234')

        with patch(
            f'{TASK_UTILS}.refresh_user_reports_materialized_view',
            side_effect=RuntimeError('refresh boom'),
        ):
            refresh_user_report_snapshots()

        assert cache.get(LOCK_KEY) is None
        run = BillingAndUsageSnapshotRun.objects.get()
        # A run only reaches `completed` once its view refresh has also
        # succeeded, not just its data: since the refresh failed, it stays
        # `in_progress` so the next invocation resumes it (bypassing the
        # cooldown) and retries just the refresh instead of leaving the
        # view stale for the whole cooldown period.
        assert run.status == BillingAndUsageSnapshotStatus.IN_PROGRESS
        assert run.details['mv_refresh_failed'] is True

    def test_resumed_run_retries_only_the_view_when_data_already_processed(self):
        """
        If a previous invocation processed every organization but its final
        view refresh failed, the run was left `in_progress` (see
        `test_lock_still_released_when_refresh_itself_fails`) with its
        cursor past every organization. The next invocation must resume it
        without reprocessing any organization, retrying only the view
        refresh.
        """
        baker.make(Organization, id='org_abcd1234')
        run = BillingAndUsageSnapshotRun.objects.create(
            status=BillingAndUsageSnapshotStatus.IN_PROGRESS,
            last_processed_org_id='org_abcd1234',
            details={'mv_refresh_failed': True},
        )

        with patch(f'{TASK_UTILS}._process_chunk') as mock_process_chunk, patch(
            f'{TASK_UTILS}.refresh_user_reports_materialized_view'
        ) as mock_refresh:
            refresh_user_report_snapshots()

        assert mock_process_chunk.call_count == 0
        assert mock_refresh.call_count == 1
        assert cache.get(LOCK_KEY) is None
        assert BillingAndUsageSnapshotRun.objects.count() == 1
        run.refresh_from_db()
        assert run.status == BillingAndUsageSnapshotStatus.COMPLETED
        assert run.details['mv_refresh_failed'] is False

    def test_resumed_view_only_retry_still_marks_refresh_failed_when_it_fails_again(
        self,
    ):
        baker.make(Organization, id='org_abcd1234')
        run = BillingAndUsageSnapshotRun.objects.create(
            status=BillingAndUsageSnapshotStatus.IN_PROGRESS,
            last_processed_org_id='org_abcd1234',
            details={'mv_refresh_failed': True},
        )

        with patch(
            f'{TASK_UTILS}.refresh_user_reports_materialized_view',
            side_effect=RuntimeError('refresh boom again'),
        ):
            refresh_user_report_snapshots()

        assert cache.get(LOCK_KEY) is None
        run.refresh_from_db()
        assert run.status == BillingAndUsageSnapshotStatus.IN_PROGRESS
        assert run.details['mv_refresh_failed'] is True

    def test_de_throned_worker_touches_no_shared_state(self):
        """
        Ownership lives on the run row: a replacement worker takes over by
        stamping its own token there. Since every write this worker makes
        carries its own token as a condition, being de-throned mid-chunk
        stops it from advancing the cursor, deleting stale snapshots,
        publishing the view or setting the status - all of which now belong
        to the worker that owns the run.

        `process_chunk` itself needs no such guard: its upserts are
        idempotent and stamp the same run id, so overlapping there is
        duplicated work rather than conflicting writes.
        """
        baker.make(Organization, id='org_abcd1234')

        def claim_run_for_someone_else(chunk_qs, usage_map, limits_map, run_pk):
            # A replacement worker claims the run while this chunk runs.
            other = BillingAndUsageSnapshotRun.objects.get(pk=run_pk)
            other.details['owner_token'] = 'claimed-by-a-replacement'
            other.save(update_fields=['details'])
            return 'org_abcd1234'

        with patch(
            f'{TASK_UTILS}._process_chunk',
            side_effect=claim_run_for_someone_else,
        ), patch(f'{TASK_UTILS}._cleanup_stale_snapshots') as mock_cleanup, patch(
            f'{TASK_UTILS}.refresh_user_reports_materialized_view'
        ) as mock_refresh:
            refresh_user_report_snapshots()

        assert mock_cleanup.call_count == 0
        assert mock_refresh.call_count == 0
        run = BillingAndUsageSnapshotRun.objects.get()
        assert run.status == BillingAndUsageSnapshotStatus.IN_PROGRESS
        # Not even the cursor moved, and the replacement's claim still stands.
        assert run.last_processed_org_id is None
        assert run.details['owner_token'] == 'claimed-by-a-replacement'

    def test_de_throned_worker_does_not_publish_from_the_failure_path(self):
        """
        The interruption paths publish the view so partial progress does not
        wait for a whole pass to succeed. That still belongs to whoever owns
        the run: a worker taken over before failing must leave the view to
        its replacement rather than add a redundant global refresh.
        """
        baker.make(Organization, id='org_abcd1234')

        def claim_run_then_fail(chunk_qs, usage_map, limits_map, run_pk):
            other = BillingAndUsageSnapshotRun.objects.get(pk=run_pk)
            other.details['owner_token'] = 'claimed-by-a-replacement'
            other.save(update_fields=['details'])
            raise RuntimeError('boom')

        with patch(
            f'{TASK_UTILS}._process_chunk',
            side_effect=claim_run_then_fail,
        ), patch(
            f'{TASK_UTILS}.refresh_user_reports_materialized_view'
        ) as mock_refresh:
            refresh_user_report_snapshots()

        assert mock_refresh.call_count == 0
        run = BillingAndUsageSnapshotRun.objects.get()
        assert run.status == BillingAndUsageSnapshotStatus.IN_PROGRESS
        # The replacement's claim stands and no error was pinned on its run.
        assert run.details['owner_token'] == 'claimed-by-a-replacement'
        assert 'last_error' not in run.details

    def test_run_claimed_after_the_last_guarded_write_skips_the_refresh(self):
        """
        Ownership can change hands after the final guarded write, between it
        and the view refresh in `finally`. Refreshing then would not corrupt
        anything - the refresh is idempotent and only makes the view fresher
        - but it is a redundant global refresh that the run's new owner is
        going to do anyway, so a de-throned worker skips it.
        """
        baker.make(Organization, id='org_abcd1234')

        def claim_run_for_someone_else(run_pk, owner_token):
            other = BillingAndUsageSnapshotRun.objects.get(pk=run_pk)
            other.details['owner_token'] = 'claimed-by-a-replacement'
            other.save(update_fields=['details'])

        with patch(
            f'{TASK_UTILS}._cleanup_stale_snapshots',
            side_effect=claim_run_for_someone_else,
        ), patch(
            f'{TASK_UTILS}.refresh_user_reports_materialized_view'
        ) as mock_refresh:
            refresh_user_report_snapshots()

        assert mock_refresh.call_count == 0
        run = BillingAndUsageSnapshotRun.objects.get()
        assert run.status == BillingAndUsageSnapshotStatus.IN_PROGRESS

    def test_cleanup_stops_deleting_once_ownership_is_lost(self):
        """
        Regression test: `_cleanup_stale_snapshots` used to check ownership
        once before starting, then delete every stale chunk unguarded. A
        worker that lost the run mid-cleanup could keep deleting chunks a
        replacement worker's own pass had since written under the same run
        id (Greptile finding on the PR).
        """
        other_run = BillingAndUsageSnapshotRun.objects.create(
            status=BillingAndUsageSnapshotStatus.COMPLETED,
        )
        # Backdated so `is_in_cooldown()` allows this test's new run to start.
        BillingAndUsageSnapshotRun.objects.filter(pk=other_run.pk).update(
            date_modified=timezone.now() - timedelta(hours=5)
        )
        stale_orgs = [baker.make(Organization, id=f'org_stale{i}') for i in range(2)]
        for org in stale_orgs:
            baker.make(
                BillingAndUsageSnapshot, organization=org, last_snapshot_run=other_run
            )

        deleted_count = {'n': 0}

        def steal_ownership_after_first_delete(sender, instance, **kwargs):
            deleted_count['n'] += 1
            if deleted_count['n'] == 1:
                # Simulate a replacement worker taking over right before
                # this worker's second cleanup chunk. The ownership check
                # is now inside the delete's own SQL (an `Exists()` against
                # the run row), so this must change the database, not just
                # intercept a Python-level call.
                run = BillingAndUsageSnapshotRun.objects.exclude(pk=other_run.pk).get()
                run.details['owner_token'] = 'claimed-by-a-replacement'
                run.save(update_fields=['details'])

        post_delete.connect(
            steal_ownership_after_first_delete, sender=BillingAndUsageSnapshot
        )
        self.addCleanup(
            post_delete.disconnect,
            steal_ownership_after_first_delete,
            sender=BillingAndUsageSnapshot,
        )

        with patch(f'{TASK_UTILS}._iter_org_chunks_after', return_value=[]), patch(
            f'{TASK_UTILS}.CHUNK_SIZE', 1
        ):
            refresh_user_report_snapshots()

        # Only the first stale chunk was deleted before ownership was lost.
        assert (
            BillingAndUsageSnapshot.objects.filter(organization__in=stale_orgs).count()
            == 1
        )
        run = BillingAndUsageSnapshotRun.objects.exclude(pk=other_run.pk).get()
        assert run.status == BillingAndUsageSnapshotStatus.IN_PROGRESS
