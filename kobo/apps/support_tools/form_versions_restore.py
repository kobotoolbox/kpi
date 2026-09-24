from collections import defaultdict

from celery.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded
from django.conf import settings
from django.core.cache import cache
from django.db.models import Exists, OuterRef, Q
from pymongo import UpdateOne
from redis.exceptions import LockError

from kobo.apps.openrosa.apps.logger.models import Instance, XForm
from kobo.apps.openrosa.apps.logger.models.instance import InstanceHistory
from kobo.apps.openrosa.apps.logger.utils.attachment_restore import (
    CHUNK_SIZE,
    CURSOR_CACHE_TTL,
    LOCK_CACHE_TTL,
    LOG_EVERY,
    ProjectAlreadyBeingRestoredError,
)
from kobo.apps.openrosa.apps.logger.xform_instance_parser import set_form_versions
from kobo.apps.openrosa.libs.utils import common_tags
from kobo.apps.support_tools.utils import rebuild_form_versions
from kpi.deployment_backends.kc_access.utils import kc_transaction_atomic

INSTANCE_FIELDS = (
    'pk',
    'xml',
    'date_created',
)


def get_lock_cache_key(asset_uid: str) -> str:
    """
    Return the key a run holds while it works on a project.

    Built from the project alone, so that whoever wants to know whether a run
    is still alive can ask without resolving the form first.
    """

    return f'restore_formversions_in_submissions_lock__{asset_uid}'


class FormVersionsRestorer:
    """
    Write `meta/formVersions` into the submissions of one project that went
    through several form versions before `add_form_versions()` started
    recording them.

    Two kinds of submission are concerned: the ones edited while a newer
    version was deployed, and the ones collected offline with an older version
    than the one deployed when they arrived. The history is rebuilt by
    `rebuild_form_versions()` from the submission's `InstanceHistory` rows and
    the dates the asset's versions were deployed.

    A version is only ever added, never removed, so running this twice, or on a
    submission that already records its history, changes nothing.

    Progress is remembered per project and per mode, so a run cut short resumes
    where it stopped rather than walking the project again.
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
        self.updated = 0
        self.completed = False
        self._lock = None
        self._deployed_versions = []

    @property
    def cursor_cache_key(self) -> str:
        """
        Key the cursor by project *and* by mode: a dry run walks the same rows
        without writing any of them, so letting it share a cursor with a real
        run would silently cut the front off whichever came second.
        """

        mode = 'dry' if self.dry_run else 'write'

        return (
            f'restore_formversions_in_submissions__{self.xform.kpi_asset_uid}__{mode}'
        )

    @property
    def lock_cache_key(self) -> str:
        """
        One lock per project, whatever the mode.
        """

        return get_lock_cache_key(self.xform.kpi_asset_uid)

    def run(self):
        """
        Walk the submissions of the project that may span several versions and
        record those versions, alone on that project.
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
        Return the next batch of submissions that may span several versions,
        newest first.

        Only two kinds can: a submission edited at least once, which left an
        `InstanceHistory` row behind, and one received once a second version
        had been deployed, which may have been collected with the first.
        Everything else was collected and received under a single version.
        """

        second_deployment_date = self._deployed_versions[1][0]

        queryset = Instance.objects.filter(xform_id=self.xform.pk).filter(
            Q(Exists(InstanceHistory.objects.filter(xform_instance_id=OuterRef('pk'))))
            | Q(date_created__gte=second_deployment_date)
        )

        if cursor:
            queryset = queryset.filter(pk__lt=cursor)

        return list(queryset.only(*INSTANCE_FIELDS).order_by('-pk')[:CHUNK_SIZE])

    def _get_histories(self, instance_ids: list) -> dict:
        """
        Return the `(xml, date_created)` of each submission's `InstanceHistory`
        rows, oldest first.
        """

        histories = defaultdict(list)

        for instance_id, xml, date_created in (
            InstanceHistory.objects.filter(xform_instance_id__in=instance_ids)
            .order_by('pk')
            .values_list('xform_instance_id', 'xml', 'date_created')
        ):
            histories[instance_id].append((xml, date_created))

        return histories

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
                f'Resuming below submission #{cursor}, where an earlier run'
                f' stopped. Pass `--no-resume` to start over'
            )

        return cursor or 0

    def _load_deployed_versions(self) -> list:
        """
        Return the `(date, uid)` of every deployed version of the asset, oldest
        first.
        """

        # Imported here because `kpi.models` reaches back into this app
        from kpi.models import AssetVersion

        return list(
            AssetVersion.objects.filter(
                asset__uid=self.xform.kpi_asset_uid, deployed=True
            )
            .order_by('date_modified')
            .values_list('date_modified', 'uid')
        )

    def _release_lock(self):
        """
        Give the project back, and only while it is still ours.
        """

        try:
            self._lock.release()
        except LockError:
            # Already expired or taken over, and nothing of ours left to free
            pass

    def _restore_batch(self, instances: list) -> int:
        """
        Return how many submissions of the batch were updated, or would have
        been on a dry run.
        """

        histories = self._get_histories([instance.pk for instance in instances])
        to_update = {}

        for instance in instances:
            try:
                form_versions = rebuild_form_versions(
                    instance.xml,
                    instance.date_created,
                    histories[instance.pk],
                    self._deployed_versions,
                )
            except (SoftTimeLimitExceeded, TimeLimitExceeded):
                raise
            except Exception as e:  # noqa
                # A submission we cannot read, malformed XML for instance, is
                # never worth failing the whole run over
                self.log(f'Instance #{instance.pk} skipped, {type(e).__name__}: {e}')
                continue

            if not form_versions:
                continue

            xml = set_form_versions(instance.xml, form_versions)
            if xml == instance.xml:
                # No `<meta>` to anchor on, or a `formVersions` node of a shape
                # `set_form_versions()` refuses to touch
                self.log(
                    f'Instance #{instance.pk} skipped, its XML cannot take'
                    f' `meta/formVersions`'
                )
                continue

            verb = 'Would record' if self.dry_run else 'Recording'
            self.log(f'Instance #{instance.pk}: {verb} `{form_versions}`')
            to_update[instance.pk] = (xml, form_versions)

        if to_update and not self.dry_run:
            self._write_batch(to_update)

        return len(to_update)

    def _run(self):
        self.log(f'Project {self.xform.kpi_asset_uid}: "{self.xform.title}"')

        if self.dry_run:
            self.log('Dry run: no change will be written')

        self._deployed_versions = self._load_deployed_versions()

        if len(self._deployed_versions) < 2:
            self.log(
                'The form was deployed only once, so no submission can span'
                ' several versions'
            )
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
            self.updated += self._restore_batch(batch)

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
                    f'{self.scanned} submissions scanned, {self.updated} updated,'
                    f' now below #{cursor}'
                )

        self.completed = True
        cache.delete(self.cursor_cache_key)

        verb = 'to update' if self.dry_run else 'updated'
        self.log(f'Done. {self.scanned} submission(s) scanned, {self.updated} {verb}.')

    def _write_batch(self, to_update: dict):
        """
        Rewrite the XML of each submission and its Mongo document as one.

        `.update()` rather than `.save()`: this is not an edit, so no signal
        should fire and `date_modified` should not move. `xml_hash` is left
        alone on purpose, it is computed on the XML without `meta/formVersions`.
        """

        with kc_transaction_atomic():
            for instance_id, (xml, _) in to_update.items():
                Instance.objects.filter(pk=instance_id).update(xml=xml)

            # Keep the Mongo update inside the PostgreSQL transaction, so that the
            # two stay in sync. If Mongo fails, PostgreSQL is rolled back and the
            # next run writes the same documents again, which is harmless
            settings.MONGO_DB.instances.bulk_write(
                [
                    UpdateOne(
                        {'_id': instance_id},
                        {'$set': {common_tags.META_FORM_VERSIONS: form_versions}},
                    )
                    for instance_id, (_, form_versions) in to_update.items()
                ]
            )
