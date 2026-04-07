import datetime

from django.utils import timezone
from django_celery_beat.schedulers import DatabaseScheduler


class ThrottledDatabaseScheduler(DatabaseScheduler):
    """
    A DatabaseScheduler that limits full schedule reloads to at most once
    every RELOAD_INTERVAL seconds.

    By default, DatabaseScheduler reloads all PeriodicTasks from the DB every
    time `schedule_changed()` returns True. Each PeriodicTask save or delete
    triggers a `PeriodicTasks.update_changed()` DB write, which Beat detects
    and treats as a signal to reload. On high-volume servers — where hundreds
    of one_off tasks complete concurrently — this causes Beat to spend most of
    its time reloading rather than dispatching tasks.

    This subclass always calls `super().schedule_changed()` to keep its
    internal `_last_timestamp` in sync with the DB. It then gates the actual
    reload behind a minimum time interval: if a reload already happened within
    RELOAD_INTERVAL, subsequent `schedule_changed()` calls return False until
    the window expires.

    Note: a change detected during the throttle window is suppressed — Beat
    will not reload for it. The next change detected after the window expires
    will trigger a reload. This is an accepted trade-off: trash-bin tasks are
    scheduled days in the future, so a delay of up to RELOAD_INTERVAL before
    Beat picks them up is negligible.

    The only practical trade-off is that a newly created PeriodicTask may take
    up to RELOAD_INTERVAL seconds to be picked up by Beat. For trash bin tasks
    scheduled days in the future, this is negligible.
    """

    RELOAD_INTERVAL = datetime.timedelta(seconds=15)

    def __init__(self, *args, **kwargs):
        self._last_reload = None
        super().__init__(*args, **kwargs)

    def schedule_changed(self):
        # Always call super() to keep _last_timestamp current. Without this,
        # we would accumulate a stale timestamp and trigger a spurious reload
        # the moment the throttle window expires, even if nothing changed.
        if not super().schedule_changed():
            return False

        now = timezone.now()
        if (
            self._last_reload is not None
            and (now - self._last_reload) < self.RELOAD_INTERVAL
        ):
            return False

        self._last_reload = now
        return True
