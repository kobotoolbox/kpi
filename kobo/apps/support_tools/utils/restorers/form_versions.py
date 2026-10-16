from collections import defaultdict

from celery.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded

from kobo.apps.openrosa.apps.logger.models import Instance, XForm
from kobo.apps.openrosa.apps.logger.models.instance import InstanceHistory
from kobo.apps.openrosa.apps.logger.xform_instance_parser import set_form_versions
from kobo.apps.openrosa.libs.utils import common_tags
from kobo.apps.support_tools.utils.helpers import rebuild_form_versions
from kobo.apps.support_tools.utils.logger import DEBUG, VERBOSE
from kobo.apps.support_tools.utils.restorers.base import CHUNK_SIZE, ProjectRestorer
from kpi.deployment_backends.kc_access.utils import kc_transaction_atomic
from kpi.utils.mongo_helper import MongoHelper


class FormVersionsRestorer(ProjectRestorer):
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
    """

    cache_key_prefix = 'restore_formversions_in_submissions'
    item_label = 'submission'

    def __init__(
        self,
        xform: XForm,
        dry_run: bool = True,
        resume: bool = True,
        log: callable = None,
    ):
        super().__init__(xform, dry_run=dry_run, resume=resume, log=log)

        self.updated = 0
        self._deployed_versions = []
        self._second_deployment_date = None

    def _fetch_batch(self, cursor: int) -> list:
        """
        Return the next batch of submissions of the project, newest first, with
        only what it takes to tell whether they may span several versions.

        Every submission is walked, and the candidates are picked in Python by
        `_get_candidates()`. Filtering them in SQL would take an `EXISTS` on
        `InstanceHistory` `OR`-ed with a date, which no index serves: on a large
        project with few candidates, a single query would test the `EXISTS` on
        most of the project to fill one batch. Walking the primary key keeps
        every query to one batch, whatever the project looks like.
        """

        queryset = Instance.objects.filter(xform_id=self.xform.pk)

        if cursor:
            queryset = queryset.filter(pk__lt=cursor)

        # `xml_hash` as it is before anything else is read, which is what an
        # edit coming in during the run is caught by, see `_write_batch()`
        return list(
            queryset.only('pk', 'date_created', 'xml_hash').order_by('-pk')[:CHUNK_SIZE]
        )

    def _get_candidates(self, instances: list, histories: dict) -> list:
        """
        Return the submissions of the batch that may span several versions,
        with their XML.

        Only two kinds can: a submission edited at least once, which left an
        `InstanceHistory` row behind, and one received once a second version
        had been deployed, which may have been collected with the first.
        Everything else was collected and received under a single version, so
        its XML is not even loaded.

        A candidate edited since `_fetch_batch()` read it is left out: its
        history was read before that edit, so it would be rebuilt from a past
        that is no longer complete.
        """

        hashes = {instance.pk: instance.xml_hash for instance in instances}

        candidate_ids = [
            instance.pk
            for instance in instances
            if instance.pk in histories
            or instance.date_created >= self._second_deployment_date
        ]

        if not candidate_ids:
            return []

        candidates = []
        for instance in (
            Instance.objects.filter(pk__in=candidate_ids)
            .only('pk', 'xml', 'date_created', 'xml_hash')
            .order_by('-pk')
        ):
            if instance.xml_hash != hashes[instance.pk]:
                self._log_edited_meanwhile(instance)
                continue
            candidates.append(instance)

        return candidates

    def _get_histories(self, instance_ids: list) -> dict:
        """
        Return the `(xml, date_created)` of each submission's `InstanceHistory`
        rows, oldest first. Submissions never edited are left out.
        """

        histories = defaultdict(list)

        for instance_id, xml, date_created in (
            InstanceHistory.objects.filter(xform_instance_id__in=instance_ids)
            .order_by('pk')
            .values_list('xform_instance_id', 'xml', 'date_created')
        ):
            histories[instance_id].append((xml, date_created))

        return histories

    def _load_deployed_versions(self) -> list[dict]:
        """
        Return the `uid`, `uid_aliases`, `_reversion_version` and
        `date_modified` of every deployed version of the asset, oldest first.
        The aliases and the reversion id are what old submissions may name
        their version by.
        """

        # Imported here because `kpi.models` reaches back into this app
        from kpi.models import AssetVersion

        return list(
            AssetVersion.objects.filter(
                asset__uid=self.xform.kpi_asset_uid, deployed=True
            )
            .order_by('date_modified')
            .values('uid', 'uid_aliases', '_reversion_version', 'date_modified')
        )

    def _log_edited_meanwhile(self, instance: Instance):
        self.log(
            f'Instance #{instance.pk} skipped, edited during the run. A run'
            f' from the start, without resuming, updates it.'
        )

    def _log_progress(self, cursor: int):
        self.log(
            f'{self.scanned} submissions scanned, {self.updated} updated,'
            f' now below #{cursor}'
        )

    def _log_summary(self):
        verb = 'to update' if self.dry_run else 'updated'
        self.log(f'Done. {self.scanned} submission(s) scanned, {self.updated} {verb}.')

    def _prepare(self) -> bool:
        self._deployed_versions = self._load_deployed_versions()

        if len(self._deployed_versions) < 2:
            self.log(
                'The form was deployed only once, so no submission can span'
                ' several versions'
            )
            return False

        # Before that date, only one version had ever been deployed, so a
        # submission received earlier and never edited cannot span two
        self._second_deployment_date = self._deployed_versions[1]['date_modified']

        return True

    def _restore_batch(self, instances: list):
        """
        Record the versions of each submission of the batch that misses some,
        or only count them on a dry run.
        """

        histories = self._get_histories([instance.pk for instance in instances])
        candidates = self._get_candidates(instances, histories)
        to_update = []

        self.log(
            f'  {len(candidates)} candidate(s), {len(histories)} edited at least once',
            VERBOSE,
        )

        for instance in candidates:
            self.log(
                f'Instance #{instance.pk}, received'
                f' {instance.date_created.isoformat()},'
                f' {len(histories[instance.pk])} edit(s):',
                DEBUG,
            )

            try:
                form_versions = rebuild_form_versions(
                    instance.xml,
                    instance.date_created,
                    histories[instance.pk],
                    self._deployed_versions,
                    log=self.log,
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
            instance.xml = xml
            to_update.append((instance, form_versions))

        if to_update and not self.dry_run:
            to_update = self._write_batch(to_update)

        # Only once written, so a batch that failed is not counted as updated
        self.updated += len(to_update)

    def _write_batch(self, to_update: list[tuple[Instance, str]]) -> list[Instance]:
        """
        Rewrite the XML of each submission and its Mongo document as one, and
        return the ones written.

        A queryset `update()` rather than `save()`: this is not an edit, so no
        signal should fire and `date_modified` should not move. Only `xml` is
        written. `xml_hash` does not change, and recomputing it would write the
        same value back: `Instance.get_hash()` strips `meta/formVersions` before
        hashing, precisely so that the server-side node never alters it.

        One `UPDATE` per submission, conditioned on `xml_hash` still being the
        one the history was rebuilt from. Every edit changes it, since the
        `instanceID` changes, so an edit that came in since is never overwritten
        with the XML read before it: the submission is left for the next run.
        The condition and the write are one statement, so an edit committing
        at the same time either lands first and is kept, or waits for this one.

        Mongo gets one `update_many()` per distinct value rather than one update
        per document: submissions of a project mostly share the same few
        histories, e.g. every one collected offline with the same old version.
        """

        written = []
        ids_per_form_versions = defaultdict(list)

        with kc_transaction_atomic():
            for instance, form_versions in to_update:
                if not Instance.objects.filter(
                    pk=instance.pk, xml_hash=instance.xml_hash
                ).update(xml=instance.xml):
                    self._log_edited_meanwhile(instance)
                    continue

                written.append(instance)
                ids_per_form_versions[form_versions].append(instance.pk)

            # Keep the Mongo update inside the PostgreSQL transaction, so that the
            # two stay in sync. If Mongo fails, PostgreSQL is rolled back and the
            # next run writes the same documents again, which is harmless
            for form_versions, instance_ids in ids_per_form_versions.items():
                MongoHelper.update_many(
                    {'_id': {'$in': instance_ids}},
                    {common_tags.META_FORM_VERSIONS: form_versions},
                )

        return written
