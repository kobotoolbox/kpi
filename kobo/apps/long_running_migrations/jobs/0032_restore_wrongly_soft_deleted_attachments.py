# Generated on 2026-09-11

import re
from collections import defaultdict

from celery.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded
from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from django.utils import timezone

from kobo.apps.long_running_migrations.models import LongRunningMigration
from kobo.apps.openrosa.apps.logger.models import Attachment, Instance, XForm
from kobo.apps.openrosa.apps.logger.models.attachment import AttachmentDeleteStatus
from kobo.apps.openrosa.apps.logger.utils.attachment import (
    bulk_update_attachment_storage_counters,
)
from kobo.apps.openrosa.apps.logger.xform_instance_parser import (
    get_xform_media_question_xpaths,
)
from kobo.apps.openrosa.apps.viewer.models.parsed_instance import ParsedInstance
from kobo.apps.openrosa.libs.utils.logger_tools import get_submission_media_basenames
from kpi.deployment_backends.kc_access.utils import kc_transaction_atomic
from kpi.utils.files import normalize_nfc
from kpi.utils.log import logging

CHUNK_SIZE = settings.LONG_RUNNING_MIGRATION_SMALL_BATCH_SIZE
CURSOR_CACHE_KEY = 'lrm_0032_cursor'
LOG_EVERY = 100
MIGRATION_NAME = '0032_restore_wrongly_soft_deleted_attachments'
# How many forms the xpath memo holds before being emptied. Deletions cluster by
# project, so a handful of entries already catch most of the repetition, and the
# database holds 2.8 M forms: an unbounded memo would grow until the pod is
# killed
XFORM_XPATHS_MAX = 500

ATTACHMENT_FIELDS = (
    'pk',
    'uid',
    'instance_id',
    'xform_id',
    'media_file_basename',
    'deleted_at',
)

# Background audio, which `get_soft_deleted_attachments()` never matches against
# a question either
COLLECT_BACKGROUND_AUDIO_RE = re.compile(r'^\d{10,}\.(m4a|amr)$')
ENKETO_BACKGROUND_AUDIO_RE = re.compile(r'^background-audio-\d{8}_\d{6}\.webm$')


def run():
    """
    Bring back the attachments that `get_soft_deleted_attachments()` retired by
    mistake, i.e. every soft-deleted file its submission still references at a
    media question.
    """

    # The date this migration was registered, i.e. the release carrying the last of the
    # fixes. Anything retired after it was retired by a version that gets the comparison
    # right, so it falls out of scope.
    registered_at = LongRunningMigration.objects.values_list(
        'date_created', flat=True
    ).get(name=MIGRATION_NAME)
    cursor = cache.get(CURSOR_CACHE_KEY)

    # Carried from batch to batch rather, since consecutive batches keep landing on the
    # same projects.
    xform_xpaths = {}
    restored = 0
    batches = 0

    while True:
        batch = _fetch_batch(cursor, registered_at)

        if not batch:
            cache.delete(CURSOR_CACHE_KEY)
            break

        restored += _restore_batch(batch, xform_xpaths)
        last = batch[-1]
        cursor = (last.deleted_at, last.pk)
        cache.set(CURSOR_CACHE_KEY, cursor, timeout=None)

        batches += 1
        if not batches % LOG_EVERY:
            logging.info(
                f'[LRM 0032] {batches} batches, {restored} attachments restored,'
                f' now at {cursor[0]}'
            )

    logging.info(f'[LRM 0032] done, {restored} attachments restored')


def _fetch_batch(cursor, registered_at) -> list:
    """
    Return the next batch of soft-deleted attachments, oldest deletion first.

    Paginating on `deleted_at` rather than on `id` is what keeps this cheap: the
    `delete_status` index cannot answer an `ORDER BY id` without sorting
    millions of rows first. Tie-breaking on `id` is needed because every
    attachment retired by one request shares its timestamp, which has the happy
    side effect of grouping them into the same batch.
    """

    queryset = Attachment.all_objects.filter(
        delete_status=AttachmentDeleteStatus.SOFT_DELETED,
        deleted_at__lt=registered_at,
    )

    if cursor:
        cursor_deleted_at, cursor_id = cursor
        queryset = queryset.filter(
            Q(deleted_at__gt=cursor_deleted_at)
            | Q(deleted_at=cursor_deleted_at, pk__gt=cursor_id)
        )

    return list(
        queryset.only(*ATTACHMENT_FIELDS).order_by('deleted_at', 'pk')[:CHUNK_SIZE]
    )


def _get_media_question_xpaths(xform, xform_xpaths: dict) -> list:
    """
    Return the media question xpaths of a form, parsing it once per run rather
    than once per batch.
    """

    if xform.pk not in xform_xpaths:
        if len(xform_xpaths) >= XFORM_XPATHS_MAX:
            xform_xpaths.clear()
        xform_xpaths[xform.pk] = get_xform_media_question_xpaths(xform)

    return xform_xpaths[xform.pk]


def _get_basenames_in_use(instance_ids) -> dict:
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
        basenames_in_use[instance_id].add(normalize_nfc(basename))

    return basenames_in_use


def _is_left_alone(basename: str) -> bool:
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


def _pick_restorable(
    attachments: list, referenced_basenames: set, basenames_in_use: set
) -> list:
    """
    Keep the attachments their submission still references, one row per
    basename.

    The same file can hold several rows, and restoring them all would show the
    same photo several times. The most recent wins, as in
    `get_soft_deleted_attachments()`, which walks `order_by('-id')` and keeps
    the first match.
    """

    picked = {}

    for attachment in sorted(attachments, key=lambda a: a.pk, reverse=True):
        basename = normalize_nfc(attachment.media_file_basename)

        if not basename or _is_left_alone(basename):
            continue

        if basename not in referenced_basenames or basename in basenames_in_use:
            continue

        picked.setdefault(basename, attachment)

    return list(picked.values())


def _restore_batch(attachments: list, xform_xpaths: dict) -> int:
    attachments_per_xform = defaultdict(list)
    for attachment in attachments:
        attachments_per_xform[attachment.xform_id].append(attachment)

    to_restore, instance_ids = [], []

    # One project at a time, and never two forms alive at once: an XForm row
    # carries its whole XML, seven megabytes for the largest on production,
    # where a batch can touch a hundred projects
    for xform_id, xform_attachments in attachments_per_xform.items():
        restorable, touched = _restore_for_xform(
            xform_id, xform_attachments, xform_xpaths
        )
        to_restore.extend(restorable)
        instance_ids.extend(touched)

    if not to_restore:
        return 0

    _write_batch(to_restore, instance_ids)

    return len(to_restore)


def _restore_for_xform(
    xform_id: int, attachments: list, xform_xpaths: dict
) -> tuple[list, list]:
    """
    Return the attachments of one project their submission still references,
    and the submissions they belong to.
    """

    # `json` for the deployed version, `kpi_asset_uid` and `title` for
    # `XForm.asset`. `xml` is asked for only when the xpaths are not memoized
    # yet.
    only_fields = ['pk', 'json', 'kpi_asset_uid', 'title']
    if xform_id not in xform_xpaths:
        only_fields.append('xml')

    xform = XForm.objects.only(*only_fields).filter(pk=xform_id).first()

    if xform is None:
        # A project on its way to deletion keeps its files where they are,
        # `XForm.objects` hiding it is what says so
        return [], []

    attachments_per_instance = defaultdict(list)
    for attachment in attachments:
        attachments_per_instance[attachment.instance_id].append(attachment)

    basenames_in_use = _get_basenames_in_use(attachments_per_instance.keys())
    media_question_xpaths = _get_media_question_xpaths(xform, xform_xpaths)
    restorable, touched = [], []

    instances = Instance.objects.only('pk', 'xml', 'xform_id').filter(
        pk__in=attachments_per_instance.keys()
    )

    for instance in instances.iterator(chunk_size=CHUNK_SIZE):
        # Hand the XForm over rather than let each submission query it back
        instance.xform = xform

        try:
            submission_basenames = get_submission_media_basenames(
                instance, media_question_xpaths
            )
        except (SoftTimeLimitExceeded, TimeLimitExceeded):
            raise
        except Exception as e:  # noqa
            # A submission we cannot read, malformed XML or a version that does
            # not resolve, is never worth failing the whole migration over
            logging.warning(
                f'[LRM 0032] Instance #{instance.pk} skipped,'
                f' {type(e).__name__}: {e}'
            )
            continue

        if not submission_basenames:
            continue

        if picked := _pick_restorable(
            attachments_per_instance[instance.pk],
            submission_basenames,
            basenames_in_use[instance.pk],
        ):
            restorable.extend(picked)
            touched.append(instance.pk)

    return restorable, touched


def _write_batch(attachments: list, instance_ids: list):
    """
    Bring the rows back and rewrite Mongo as one, then credit the storage
    counters.

    At most `CHUNK_SIZE` attachments at a time, since this is what a batch
    picked.

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

        # Keep the Mongo update inside the PostgreSQL transaction, so that the two
        # stay in sync. If Mongo fails, PostgreSQL is rolled back.
        ParsedInstance.bulk_update_attachments(instance_ids)

    # Outside the transaction, so that the exclusive locks its `UPDATE`s take on
    # `UserProfile` and `XForm` are not held until the commit. A failure here costs
    # out-of-sync counters, one batch at most, rather than files left invisible with
    # no way to recover them
    bulk_update_attachment_storage_counters(attachment_uids, subtract=False)
