from django.conf import settings
from django.core.cache import cache
from redis.exceptions import LockError

from kobo.apps.openrosa.apps.logger.models import XForm
from kobo.apps.support_tools.exceptions import ProjectAlreadyBeingRestoredError

CHUNK_SIZE = settings.LONG_RUNNING_MIGRATION_SMALL_BATCH_SIZE
# Long enough for a run interrupted by a time limit to be picked up the same
# day, short enough that a cursor nobody ever came back to stops silently
# trimming the front of a later run
CURSOR_CACHE_TTL = 60 * 60 * 24 * 7
# Refreshed after every batch, so a run of any length keeps the project, the
# command included, which no time limit stops. Past the hard time limit, so that
# a run killed outright stops holding the project once the worker that took the
# lock can no longer be alive
LOCK_CACHE_TTL = settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT + 60 * 5
LOG_EVERY = 100


class ProjectRestorer:
    """
    Walk the rows of one project in batches, newest first, and repair them,
    alone on that project.

    Progress is remembered per project and per mode, so a run cut short by a
    soft time limit resumes where it stopped rather than walking the project
    again. A run killed outright, by an OOM or a pod eviction, leaves the cursor
    at the last committed batch; nothing restarts it on its own, but relaunching
    picks up from there.

    Subclasses name their cache keys with `cache_key_prefix`, the rows they walk
    with `item_label`, and implement `_fetch_batch()`, `_restore_batch()`,
    `_log_progress()` and `_log_summary()`. `_prepare()` lets them stop before
    the walk when the project has nothing to repair.
    """

    cache_key_prefix = None
    item_label = None

    def __init__(
        self,
        xform: XForm,
        dry_run: bool = True,
        resume: bool = True,
        log: callable = None,
    ):
        self.xform = xform
        self.dry_run = dry_run
        self.resume = resume
        self.log = log or (lambda message: None)

        self.scanned = 0
        self.completed = False
        self._lock = None

    @classmethod
    def get_lock_cache_key(cls, asset_uid: str) -> str:
        """
        Return the key a run holds while it works on a project.

        Built from the project alone, so that whoever wants to know whether a
        run is still alive can ask without resolving the form first.
        """

        return f'{cls.cache_key_prefix}_lock__{asset_uid}'

    @property
    def cursor_cache_key(self) -> str:
        """
        Key the cursor by project *and* by mode: a dry run walks the same rows
        without writing any of them, so letting it share a cursor with a real
        run would silently cut the front off whichever came second.
        """

        mode = 'dry' if self.dry_run else 'write'

        return f'{self.cache_key_prefix}__{self.xform.kpi_asset_uid}__{mode}'

    @property
    def lock_cache_key(self) -> str:
        """
        One lock per project, whatever the mode. A dry run writes nothing, but
        letting it race a real one buys nothing either.
        """

        return self.get_lock_cache_key(self.xform.kpi_asset_uid)

    def run(self):
        """
        Walk the project and repair what needs it, alone on that project.
        """

        if not self._acquire_lock():
            raise ProjectAlreadyBeingRestoredError(
                f'Another run already has {self.xform.kpi_asset_uid}. A lock'
                f' left behind by a run that died clears itself within'
                f' {LOCK_CACHE_TTL // 60} minutes.'
            )

        try:
            self._run()
        finally:
            self._release_lock()

    def _acquire_lock(self) -> bool:
        """
        Claim the project, or report that somebody else holds it.
        """

        self._lock = cache.lock(self.lock_cache_key, timeout=LOCK_CACHE_TTL)

        return self._lock.acquire(blocking=False)

    def _complete(self):
        """
        Mark the walk as done, and forget where it was.
        """

        self.completed = True
        cache.delete(self.cursor_cache_key)

    def _fetch_batch(self, cursor: int) -> list:
        """
        Return the next batch of rows below `cursor`, newest first, or all of
        the first ones when `cursor` is `0`.
        """

        raise NotImplementedError

    def _load_cursor(self) -> int:
        """
        Return where a previous run stopped, and say so, since resuming means
        the front of the project is not looked at this time.
        """

        if not self.resume:
            cache.delete(self.cursor_cache_key)
            return 0

        cursor = cache.get(self.cursor_cache_key)

        if cursor:
            self.log(
                f'Resuming below {self.item_label} #{cursor}, where an earlier run'
                f' stopped. Pass `--no-resume`, or `"resume": false`, to start over'
            )

        return cursor or 0

    def _log_progress(self, cursor: int):
        """
        Report how far the walk went, every `LOG_EVERY` batches.
        """

        raise NotImplementedError

    def _log_summary(self):
        """
        Report what the whole walk did, once it is over.
        """

        raise NotImplementedError

    def _prepare(self) -> bool:
        """
        Load whatever the walk needs, and return `False` to stop before it when
        the project has nothing to repair.
        """

        return True

    def _release_lock(self):
        """
        Give the project back, and only while it is still ours.

        Redis compares the token and deletes the key in one step, so a lock
        taken over by another run is never turned loose by this one.
        """

        try:
            self._lock.release()
        except LockError:
            # Already expired or taken over, and nothing of ours left to free
            pass

    def _restore_batch(self, batch: list):
        """
        Repair the rows of the batch that need it, or only report them on a dry
        run.
        """

        raise NotImplementedError

    def _run(self):
        self.log(f'Project {self.xform.kpi_asset_uid}: "{self.xform.title}"')

        if self.dry_run:
            self.log('Dry run: no change will be written')

        if not self._prepare():
            self._complete()
            return

        cursor = self._load_cursor()
        batches = 0

        while True:
            batch = self._fetch_batch(cursor)

            if not batch:
                break

            self.scanned += len(batch)
            self._restore_batch(batch)

            # Only ever moved once a batch is committed, so an interruption
            # costs the batch in progress and nothing before it
            cursor = batch[-1].pk
            cache.set(self.cursor_cache_key, cursor, timeout=CURSOR_CACHE_TTL)

            # Raises if another run took the project over, which is only
            # possible once the lock expired, and then the two must not overlap
            self._lock.reacquire()

            batches += 1
            if not batches % LOG_EVERY:
                self._log_progress(cursor)

        self._complete()
        self._log_summary()
