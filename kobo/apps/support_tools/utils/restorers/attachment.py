import re
from collections import defaultdict

from celery.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded

from kobo.apps.openrosa.apps.logger.models import Attachment, Instance, XForm
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kobo.apps.openrosa.apps.logger.utils.attachment import update_delete_status
from kobo.apps.openrosa.apps.logger.utils.counters import update_storage_counters
from kobo.apps.openrosa.apps.logger.xform_instance_parser import (
    get_xform_media_question_xpaths,
)
from kobo.apps.openrosa.apps.viewer.models.parsed_instance import ParsedInstance
from kobo.apps.support_tools.utils.logger import DEBUG, VERBOSE
from kobo.apps.support_tools.utils.restorers.base import CHUNK_SIZE, ProjectRestorer
from kpi.deployment_backends.kc_access.utils import kc_transaction_atomic
from kpi.utils.files import normalize_nfc

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


class AttachmentRestorer(ProjectRestorer):
    """
    Bring back the attachments of one project that `get_soft_deleted_attachments()`
    retired by mistake, i.e. every soft-deleted file its submission still
    references at a media question.

    The criterion is cause-agnostic on purpose. The victims come from a family
    of bugs that all produce the same symptom, a stored `media_file_basename`
    that does not match the XML, so the question asked is not "was this deletion
    a mistake at the time" but "should this file be visible today".

    Two runs overlapping would not credit the same bytes twice, since
    `update_delete_status()` only counts the rows it changed itself. They would
    still walk and rewrite the same submissions, hence the lock
    `ProjectRestorer` holds.
    """

    cache_key_prefix = 'restore_soft_deleted_attachments'
    item_label = 'attachment'

    def __init__(
        self,
        xform: XForm,
        dry_run: bool = True,
        resume: bool = True,
        log: callable = None,
    ):
        super().__init__(xform, dry_run=dry_run, resume=resume, log=log)

        self.restored = 0
        self.skipped_without_basename = 0
        self._media_question_xpaths = []
        # Names already picked per submission during this run. A real run finds
        # them live in the database anyway, a dry run writes nothing and would
        # otherwise report the same name once per row
        self._picked_basenames = defaultdict(set)

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

    def _log_progress(self, cursor: int):
        self.log(
            f'{self.scanned} attachments scanned, {self.restored} restored,'
            f' now below #{cursor}'
        )

    def _log_summary(self):
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

    def _prepare(self) -> bool:
        self._media_question_xpaths = get_xform_media_question_xpaths(self.xform)

        if not self._media_question_xpaths:
            # Nothing to compare the attachments against, and that is also the
            # right answer for a form that dropped its only media question in a
            # later version
            self.log('The form holds no media question, nothing to restore')
            return False

        return True

    def _restore_batch(self, attachments: list):
        """
        Restore the attachments of the batch their submission still references,
        or only count them on a dry run.
        """

        from kobo.apps.openrosa.libs.utils.logger_tools import (
            get_submission_media_basenames,  # Avoid circular import
        )

        attachments_per_instance = defaultdict(list)
        for attachment in attachments:
            attachments_per_instance[attachment.instance_id].append(attachment)

        basenames_in_use = self._get_basenames_in_use(attachments_per_instance.keys())
        to_restore, instance_ids = [], []

        self.log(f'  {len(attachments_per_instance)} submission(s)', VERBOSE)

        instances = Instance.objects.only('pk', 'xml', 'xform_id').filter(
            pk__in=attachments_per_instance.keys()
        )

        for instance in instances.iterator(chunk_size=CHUNK_SIZE):
            # Hand the XForm over rather than let each submission query it back
            instance.xform = self.xform

            try:
                submission_basenames = get_submission_media_basenames(
                    instance, self._media_question_xpaths
                )
            except (SoftTimeLimitExceeded, TimeLimitExceeded):
                raise
            except Exception as e:  # noqa
                # A submission we cannot read, malformed XML or a version that
                # does not resolve, is never worth failing the whole run over
                self.log(f'Instance #{instance.pk} skipped, {type(e).__name__}: {e}')
                continue

            soft_deleted = sorted(
                attachment.media_file_basename or ''
                for attachment in attachments_per_instance[instance.pk]
            )
            self.log(
                f'Instance #{instance.pk}:'
                f' referenced={sorted(submission_basenames or [])}'
                f' soft_deleted={soft_deleted}'
                f' in_use={sorted(basenames_in_use[instance.pk])}',
                DEBUG,
            )

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

        if to_restore and not self.dry_run:
            self._write_batch(to_restore, instance_ids)

        # Only once written, so a batch that failed is not counted as restored
        self.restored += len(to_restore)

    def _write_batch(self, attachments: list, instance_ids: list):
        """
        Bring the rows back, rewrite Mongo and credit the storage counters, as
        one transaction.

        The order is constrained: `ParsedInstance.bulk_update_attachments()`
        reads the rows back and only keeps the ones whose `delete_status` is
        already `NULL`, so it follows the update. It reads them uncommitted,
        from the same connection. The counters come last, so the project rows
        stay locked as briefly as possible.
        """

        attachment_uids = [attachment.uid for attachment in attachments]
        with kc_transaction_atomic():
            _, storage_bytes_by_xform_id = update_delete_status(
                attachment_uids,
                from_status=AttachmentDeleteStatus.SOFT_DELETED,
                to_status=None,
                deleted_at=None,
            )

            # Keep the Mongo update inside the PostgreSQL transaction, so that the
            # two stay in sync. If Mongo fails, PostgreSQL is rolled back, but
            # Mongo cannot be: documents it already rewrote list files whose rows
            # are still soft deleted, until the next run restores those rows and
            # rewrites the same documents. The write is ordered, so it stops at
            # the first failure and keeps that set as small as it can be.
            ParsedInstance.bulk_update_attachments(instance_ids)

            update_storage_counters(storage_bytes_by_xform_id)
