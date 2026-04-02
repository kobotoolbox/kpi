from __future__ import annotations

import datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.test import TestCase
from freezegun import freeze_time

from kobo.apps.beat.schedulers import ThrottledDatabaseScheduler

UTC = ZoneInfo('UTC')


class ThrottledDatabaseSchedulerTestCase(TestCase):
    """
    Tests for ThrottledDatabaseScheduler.

    We test the throttle logic in isolation by patching:
    - `DatabaseScheduler.schedule_changed` (super) — controls whether Beat sees
      a change at all
    - `django.utils.timezone.now` (via freezegun) — controls the simulated clock

    `_last_reload` is a timezone-aware UTC datetime (set via `timezone.now()`),
    so all manually constructed datetimes in these tests use `tzinfo=UTC`.

    The throttle condition uses strict inequality: `elapsed < RELOAD_INTERVAL`.
    This means a reload is throttled while elapsed < 15s, and allowed at >= 15s.
    """

    def test_reload_allowed_on_first_change(self):
        """
        The very first schedule change is always dispatched immediately
        since _last_reload is None.
        """

        scheduler = self._make_scheduler()

        with freeze_time('2026-01-01 12:00:00'):
            with self._patch_super_changed(True):
                assert scheduler.schedule_changed() is True
                assert scheduler._last_reload == datetime.datetime(
                    2026, 1, 1, 12, 0, 0, tzinfo=UTC
                )

    def test_reload_throttled_within_interval(self):
        """
        A second change detected within RELOAD_INTERVAL is suppressed.
        Elapsed = 5s < 15s → throttled.
        """

        scheduler = self._make_scheduler()
        scheduler._last_reload = datetime.datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)

        with freeze_time('2026-01-01 12:00:05'):
            with self._patch_super_changed(True):
                assert scheduler.schedule_changed() is False

    def test_reload_throttled_at_boundary(self):
        """
        At exactly RELOAD_INTERVAL (elapsed == 15s), the reload is allowed.
        The condition is `elapsed < RELOAD_INTERVAL` (strict), so 15s < 15s
        is False → NOT throttled. Reload IS allowed at >= 15s.
        """

        scheduler = self._make_scheduler()
        scheduler._last_reload = datetime.datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)

        with freeze_time('2026-01-01 12:00:15'):
            with self._patch_super_changed(True):
                assert scheduler.schedule_changed() is True

    def test_reload_allowed_after_interval_expires(self):
        """
        A change detected after RELOAD_INTERVAL has elapsed is dispatched.
        Elapsed = 16s > 15s → allowed, and _last_reload is updated.
        """

        scheduler = self._make_scheduler()
        scheduler._last_reload = datetime.datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)

        with freeze_time('2026-01-01 12:00:16'):
            with self._patch_super_changed(True):
                assert scheduler.schedule_changed() is True
                assert scheduler._last_reload == datetime.datetime(
                    2026, 1, 1, 12, 0, 16, tzinfo=UTC
                )

    def test_no_reload_when_super_returns_false(self):
        """
        If the parent sees no change, we never reload regardless of timing.
        _last_reload stays None.
        """

        scheduler = self._make_scheduler()

        with freeze_time('2026-01-01 12:00:00'):
            with self._patch_super_changed(False):
                assert scheduler.schedule_changed() is False
                assert scheduler._last_reload is None

    def test_last_reload_not_updated_when_throttled(self):
        """
        `_last_reload` must only be updated when a reload is actually allowed,
        not when throttled. Otherwise the throttle window would reset silently
        without a real reload having happened.
        """

        scheduler = self._make_scheduler()
        original_reload = datetime.datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)
        scheduler._last_reload = original_reload

        with freeze_time('2026-01-01 12:00:05'):
            with self._patch_super_changed(True):
                scheduler.schedule_changed()
                assert scheduler._last_reload == original_reload

    def test_many_changes_within_interval_produce_one_reload(self):
        """
        Simulate what happens on Global: 100 signals fired within 10 seconds.
        Only the first one should produce a reload.
        """
        scheduler = self._make_scheduler()
        reload_count = 0

        with self._patch_super_changed(True):
            for i in range(100):
                tick = datetime.datetime(
                    2026, 1, 1, 12, 0, 0, tzinfo=UTC
                ) + datetime.timedelta(milliseconds=i * 100)  # one signal every 100ms
                with freeze_time(tick):
                    if scheduler.schedule_changed():
                        reload_count += 1

        assert reload_count == 1

    def test_reload_resumes_after_interval_in_burst(self):
        """
        After RELOAD_INTERVAL expires, the next burst of signals produces
        exactly one more reload — total of 2 reloads for 2 bursts.
        """
        scheduler = self._make_scheduler()
        reload_count = 0

        with self._patch_super_changed(True):
            # First burst: t=0s to t=9s (10 signals, 1 reload expected)
            for i in range(10):
                tick = datetime.datetime(
                    2026, 1, 1, 12, 0, 0, tzinfo=UTC
                ) + datetime.timedelta(seconds=i)
                with freeze_time(tick):
                    if scheduler.schedule_changed():
                        reload_count += 1

            # Second burst: t=20s to t=29s (past the 15s window, 1 more reload)
            for i in range(10):
                tick = datetime.datetime(
                    2026, 1, 1, 12, 0, 20, tzinfo=UTC
                ) + datetime.timedelta(seconds=i)
                with freeze_time(tick):
                    if scheduler.schedule_changed():
                        reload_count += 1

        assert reload_count == 2

    def _make_scheduler(self):
        """
        Build a ThrottledDatabaseScheduler without triggering the real
        DatabaseScheduler.__init__ (which requires a running Celery app and DB).
        """

        scheduler = ThrottledDatabaseScheduler.__new__(ThrottledDatabaseScheduler)
        scheduler._last_reload = None
        return scheduler

    def _patch_super_changed(self, return_value):

        return patch.object(
            ThrottledDatabaseScheduler.__bases__[0],
            'schedule_changed',
            return_value=return_value,
        )
