import re
from collections import defaultdict

from celery.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from redis.exceptions import LockError

from kobo.apps.openrosa.apps.logger.models import Attachment, Instance, XForm
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kobo.apps.openrosa.apps.logger.utils.attachment import (
    bulk_update_attachment_storage_counters,
)
from kobo.apps.openrosa.apps.logger.xform_instance_parser import (
    get_xform_media_question_xpaths,
)
from kobo.apps.openrosa.apps.viewer.models.parsed_instance import ParsedInstance
from kpi.deployment_backends.kc_access.utils import kc_transaction_atomic
from kpi.utils.files import normalize_nfc
from kpi.utils.log import logging
from kpi.utils.mailer import EmailMessage, Mailer

# What the runtime of this walk was measured with on production
CHUNK_SIZE = 100
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

ATTACHMENT_FIELDS = (
    'pk',
    'uid',
    'instance_id',
    'media_file_basename',
)

# Background audio, which `get_soft_deleted_attachments()` never matches against
# a question either
COLLECT_BACKGROUND_AUDIO_RE = re.compile(r'^\d{10,}\.(m4a|amr)$')
ENKETO_BACKGROUND_AUDIO_RE = re.compile(r'^background-audio-\d{8}_\d{6}\.webm$')


def get_lock_cache_key(asset_uid: str) -> str:
    """
    Return the key a run holds while it works on a project.

    Built from the project alone, so that whoever wants to know whether a run
    is still alive can ask without resolving the form first.
    """

    return f'restore_soft_deleted_attachments_lock__{asset_uid}'


def get_project_xform(asset_uid: str) -> XForm:
    """
    Return the form a project is deployed as, or explain why it has none.
    """

    # Imported here because `kpi.models` reaches back into this app
    from kpi.models import Asset

    try:
        asset = Asset.objects.defer('content').get(uid=asset_uid)
    except Asset.DoesNotExist:
        raise ValueError(f'Asset `{asset_uid}` does not exist')

    if not asset.has_deployment:
        raise ValueError(f'Asset `{asset_uid}` is not deployed')

    return asset.deployment.xform


def log_collector(echo: callable = None) -> tuple[list, callable]:
    """
    Return the list a run writes its log into and the callable that appends to
    it, optionally echoing each line somewhere else as it goes.
    """

    lines = []

    def log(message: str):
        lines.append(message)
        if echo:
            echo(message)

    return lines, log


def send_restore_log(email_to: list, asset_uid: str, lines: list):
    """
    Mail a run's log, and never let a failed send become the run's own failure:
    this is called from a `finally`, where raising would hide whatever the run
    was already reporting.
    """

    try:
        Mailer.send(
            EmailMessage(
                to=email_to,
                subject=(f'Attachment restore for project {asset_uid}'),
                plain_text_content_or_template='\n'.join(lines) + '\n',
            )
        )
    except Exception as e:  # noqa
        logging.error(
            f'Could not email the restore log of {asset_uid}: {type(e).__name__}: {e}'
        )


class ProjectAlreadyBeingRestoredError(Exception):
    pass


class AttachmentRestorer:
    """
    Bring back the attachments of one project that `get_soft_deleted_attachments()`
    retired by mistake, i.e. every soft-deleted file its submission still
    references at a media question.

    The criterion is cause-agnostic on purpose. The victims come from a family
    of bugs that all produce the same symptom, a stored `media_file_basename`
    that does not match the XML, so the question asked is not "was this deletion
    a mistake at the time" but "should this file be visible today".

    Progress is remembered per project and per mode, so a run cut short by a
    soft time limit resumes where it stopped rather than walking the project
    again. A run killed outright, by an OOM or a pod eviction, leaves the cursor
    at the last committed batch; nothing restarts it on its own, but relaunching
    picks up from there.
    """

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
        self.restored = 0
        self.skipped_without_basename = 0
        self.completed = False
        self._lock = None
        # Names already picked per submission during this run. A real run finds
        # them live in the database anyway, a dry run writes nothing and would
        # otherwise report the same name once per row
        self._picked_basenames = defaultdict(set)

    @property
    def cursor_cache_key(self) -> str:
        """
        Key the cursor by project *and* by mode: a dry run walks the same rows
        without restoring any of them, so letting it share a cursor with a real
        run would silently cut the front off whichever came second.
        """

        mode = 'dry' if self.dry_run else 'write'

        return f'restore_soft_deleted_attachments__{self.xform.kpi_asset_uid}__{mode}'

    @property
    def lock_cache_key(self) -> str:
        """
        One lock per project, whatever the mode. A dry run writes nothing, but
        letting it race a real one buys nothing either.
        """

        return get_lock_cache_key(self.xform.kpi_asset_uid)

    def run(self):
        """
        Walk every soft-deleted attachment of the project and restore the ones
        their submission still references, alone on that project.

        Two runs overlapping would credit the same bytes twice.
        `bulk_update_attachment_storage_counters()` keeps the rows whose
        `delete_status` is already `NULL`, which is exactly what the other run
        has just made true of them, and it deliberately runs outside the
        transaction, so the database cannot arbitrate either.
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

    def _fetch_batch(self, cursor: int) -> list:
        """
        Return the next batch of soft-deleted attachments of the project, newest
        first.

        Paginating on `pk` is enough here, where `xform_id` already narrows the
        walk to one project, and it gives a cursor that survives a restart as a
        plain integer. Walking it downwards is what makes the most recent of
        several rows sharing a name the one restored, even when a batch boundary
        falls between them: whichever comes back first makes the name live, and
        the guard in `_pick_restorable()` then skips the others.
        """

        queryset = Attachment.all_objects.filter(
            xform_id=self.xform.pk,
            delete_status=AttachmentDeleteStatus.SOFT_DELETED,
        )

        if cursor:
            queryset = queryset.filter(pk__lt=cursor)

        return list(queryset.only(*ATTACHMENT_FIELDS).order_by('-pk')[:CHUNK_SIZE])

    def _get_basenames_in_use(self, instance_ids) -> dict:
        """
        Return the file names each submission already carries on an attachment of
        its own.

        A submission can hold a soft-deleted row and an undeleted one under the
        same name, by design: `save_attachments()` checks a basename against the
        attachments the submission currently carries, so that uploading a file
        whose predecessor was retired stays possible. Restoring a name an undeleted
        row already carries would therefore show the same file twice.
        """

        basenames_in_use = defaultdict(set)

        for instance_id, basename in Attachment.objects.filter(
            instance_id__in=instance_ids
        ).values_list('instance_id', 'media_file_basename'):
            if basename:
                basenames_in_use[instance_id].add(normalize_nfc(basename))

        return basenames_in_use

    def _is_left_alone(self, basename: str) -> bool:
        """
        Report the files `get_soft_deleted_attachments()` excludes from its own
        queryset: audit files, encrypted submissions and background audio, none of
        which is ever matched against a media question.
        """

        return (
            basename == 'audit.csv'
            or basename.endswith('.enc')
            or bool(COLLECT_BACKGROUND_AUDIO_RE.match(basename))
            or bool(ENKETO_BACKGROUND_AUDIO_RE.match(basename))
        )

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
                f'Resuming below attachment #{cursor}, where an earlier run stopped.'
                f' Pass `--no-resume`, or `"resume": false`, to start over'
            )

        return cursor or 0

    def _pick_restorable(
        self, attachments: list, referenced_basenames: set, basenames_in_use: set
    ) -> list:
        """
        Keep the attachments their submission still references, one row per
        basename.

        The same file can hold several rows, and restoring them all would show the
        same photo several times. The most recent wins, as in
        `get_soft_deleted_attachments()`, which walks `order_by('-id')` and keeps
        the first match. Across batches, that holds because `_fetch_batch()` walks
        the project newest first.
        """

        picked = {}

        for attachment in sorted(attachments, key=lambda a: a.pk, reverse=True):
            basename = normalize_nfc(attachment.media_file_basename)

            if not basename:
                # Nothing to compare the submission against. The only other
                # signal is `media_file`, the sanitized storage path, which may
                # carry the suffix Django appends on a collision, so matching on
                # it would be a guess. Giving up on purpose.
                self.skipped_without_basename += 1
                continue

            if self._is_left_alone(basename):
                continue

            if basename not in referenced_basenames or basename in basenames_in_use:
                continue

            picked.setdefault(basename, attachment)

        return list(picked.values())

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

    def _restore_batch(self, attachments: list, media_question_xpaths: list) -> int:
        """
        Return how many attachments of the batch were restored, or would have
        been on a dry run.
        """

        from kobo.apps.openrosa.libs.utils.logger_tools import (
            get_submission_media_basenames,  # Avoid circular import
        )

        attachments_per_instance = defaultdict(list)
        for attachment in attachments:
            attachments_per_instance[attachment.instance_id].append(attachment)

        basenames_in_use = self._get_basenames_in_use(attachments_per_instance.keys())
        to_restore, instance_ids = [], []

        instances = Instance.objects.only('pk', 'xml', 'xform_id').filter(
            pk__in=attachments_per_instance.keys()
        )

        for instance in instances.iterator(chunk_size=CHUNK_SIZE):
            # Hand the XForm over rather than let each submission query it back
            instance.xform = self.xform

            try:
                submission_basenames = get_submission_media_basenames(
                    instance, media_question_xpaths
                )
            except (SoftTimeLimitExceeded, TimeLimitExceeded):
                raise
            except Exception as e:  # noqa
                # A submission we cannot read, malformed XML or a version that
                # does not resolve, is never worth failing the whole run over
                self.log(f'Instance #{instance.pk} skipped, {type(e).__name__}: {e}')
                continue

            if not submission_basenames:
                continue

            if picked := self._pick_restorable(
                attachments_per_instance[instance.pk],
                submission_basenames,
                basenames_in_use[instance.pk] | self._picked_basenames[instance.pk],
            ):
                for attachment in picked:
                    self._picked_basenames[instance.pk].add(
                        normalize_nfc(attachment.media_file_basename)
                    )
                    verb = 'Would restore' if self.dry_run else 'Restoring'
                    self.log(
                        f'Instance #{instance.pk}: {verb}'
                        f' `{attachment.media_file_basename}` ({attachment.uid})'
                    )

                to_restore.extend(picked)
                instance_ids.append(instance.pk)

        if not to_restore or self.dry_run:
            return len(to_restore)

        self._write_batch(to_restore, instance_ids)

        return len(to_restore)

    def _run(self):
        self.log(f'Project {self.xform.kpi_asset_uid}: "{self.xform.title}"')

        if self.dry_run:
            self.log('Dry run: no change will be written')

        media_question_xpaths = get_xform_media_question_xpaths(self.xform)

        if not media_question_xpaths:
            # Nothing to compare the attachments against, and that is also the
            # right answer for a form that dropped its only media question in a
            # later version
            self.log('The form holds no media question, nothing to restore')
            self.completed = True
            cache.delete(self.cursor_cache_key)
            return

        cursor = self._load_cursor()
        batches = 0

        while True:
            batch = self._fetch_batch(cursor)

            if not batch:
                break

            self.scanned += len(batch)
            self.restored += self._restore_batch(batch, media_question_xpaths)

            # Only ever moved once a batch is committed, so an interruption
            # costs the batch in progress and nothing before it
            cursor = batch[-1].pk
            cache.set(self.cursor_cache_key, cursor, timeout=CURSOR_CACHE_TTL)

            # Raises if another run took the project over, which is only
            # possible once the lock expired, and then the two must not overlap
            self._lock.reacquire()

            batches += 1
            if not batches % LOG_EVERY:
                self.log(
                    f'{self.scanned} attachments scanned, {self.restored} restored,'
                    f' now below #{cursor}'
                )

        self.completed = True
        cache.delete(self.cursor_cache_key)

        verb = 'to restore' if self.dry_run else 'restored'
        self.log(
            f'Done. {self.scanned} soft-deleted attachment(s) scanned,'
            f' {self.restored} {verb}.'
        )

        if self.skipped_without_basename:
            self.log(
                f'{self.skipped_without_basename} attachment(s) were left alone'
                f' for holding no `media_file_basename`, which leaves nothing'
                f' trustworthy to match the submission against'
            )

    def _write_batch(self, attachments: list, instance_ids: list):
        """
        Bring the rows back and rewrite Mongo as one, then credit the storage
        counters.

        The order is constrained: `ParsedInstance.bulk_update_attachments()` and
        `bulk_update_attachment_storage_counters()` both read the rows back and only
        keep the ones whose `delete_status` is already `NULL`, so both follow the
        update. Mongo reads it uncommitted, from the same connection, the counters
        read it committed.
        """

        now = timezone.now()

        attachment_uids = [attachment.uid for attachment in attachments]
        with kc_transaction_atomic():
            Attachment.all_objects.filter(uid__in=attachment_uids).update(
                delete_status=None, deleted_at=None, date_modified=now
            )

            # Keep the Mongo update inside the PostgreSQL transaction, so that the
            # two stay in sync. If Mongo fails, PostgreSQL is rolled back, but
            # Mongo cannot be: documents it already rewrote list files whose rows
            # are still soft deleted, until the next run restores those rows and
            # rewrites the same documents. The write is ordered, so it stops at
            # the first failure and keeps that set as small as it can be.
            ParsedInstance.bulk_update_attachments(instance_ids)

        # Outside the transaction, so that the exclusive locks its `UPDATE`s take on
        # `UserProfile` and `XForm` are not held until the commit. A failure here
        # costs out-of-sync counters, one batch at most, rather than files left
        # invisible with no way to recover them
        bulk_update_attachment_storage_counters(attachment_uids, subtract=False)
