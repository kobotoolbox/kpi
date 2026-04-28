from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Exists, OuterRef

from kobo.apps.subsequences.actions import ACTION_IDS_TO_CLASSES
from kobo.apps.subsequences.constants import SCHEMA_VERSIONS
from kobo.apps.subsequences.models import QuestionAdvancedFeature, SubmissionSupplement
from kobo.apps.subsequences.utils.versioning import migrate_submission_supplementals
from kpi.models import Asset

CHUNK_SIZE = 500

QUAL_TYPE_MAP = {
    'qual_select_one': 'qualSelectOne',
    'qual_select_multiple': 'qualSelectMultiple',
    'qual_text': 'qualText',
    'qual_integer': 'qualInteger',
    'qual_tags': 'qualTags',
    'qual_note': 'qualNote',
}


class Command(BaseCommand):
    """
    Migrate SubmissionSupplement records from the old format (pre-schema
    version '20250820') to the current format.

    Performs two operations:
      1. Converts old action IDs (googlets, googletx, transcript, translation)
         to current ones (automatic_google_transcription, manual_transcription,
         etc.) via migrate_submission_supplementals.
      2. Creates any QuestionAdvancedFeature records that are referenced in
         supplement content but missing from the database.

    Usage:
        # Preview what would be migrated (no changes saved)
        manage.py migrate_submission_supplements --dry-run

        # Migrate all old supplements
        manage.py migrate_submission_supplements

        # Migrate only supplements for a specific asset
        manage.py migrate_submission_supplements --asset-uid aXXXXXXXXXXXXXXXXXX
    """

    help = 'Migrate SubmissionSupplement records to the current schema version'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help='Preview changes without saving anything to the database',
        )
        parser.add_argument(
            '--asset-uid',
            type=str,
            default=None,
            help='Restrict migration to supplements belonging to this asset UID',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        asset_uid = options['asset_uid']

        qs = (
            SubmissionSupplement.objects.exclude(content__has_key='_version')
            .select_related('asset')
            .only(
                'submission_uuid',
                'content',
                'asset__uid',
            )
        )

        if asset_uid:
            qs = qs.filter(asset__uid=asset_uid)
            self.stdout.write(f'Filtering to asset: {asset_uid}')

        total = qs.count()
        migrated = 0
        skipped = 0
        errors = 0
        to_update = []

        # Collect (asset_id, xpath, action_id) combos across all supplements
        # that need a QAF created or recovered.
        missing_qaf_combos = set()

        if total > 0:
            self.stdout.write(
                f'Found {total} supplement(s) to migrate'
                + (' (dry run)' if dry_run else '')
            )

        for ss in qs.iterator(chunk_size=CHUNK_SIZE):
            content = ss.content.copy()

            if not content:
                self.stdout.write(
                    self.style.WARNING(
                        f'  Skipping supplement {ss.pk}'
                        f' (asset={ss.asset.uid}, uuid={ss.submission_uuid}):'
                        ' content is empty'
                    )
                )
                skipped += 1
                continue

            try:
                migrated_content = migrate_submission_supplementals(content)
            except Exception as e:
                self.stderr.write(
                    f'  ERROR supplement {ss.pk}'
                    f' (asset={ss.asset.uid}, uuid={ss.submission_uuid}): {e}'
                )
                errors += 1
                continue

            if migrated_content is None:
                self.stderr.write(
                    f'  SKIP supplement {ss.pk}'
                    f' (asset={ss.asset.uid}, uuid={ss.submission_uuid}):'
                    ' migrate_submission_supplementals returned None'
                )
                skipped += 1
                continue

            # Collect (asset_id, xpath, action_id) combos that need a QAF
            for xpath, action_data in migrated_content.items():
                if xpath == '_version' or not isinstance(action_data, dict):
                    continue
                for action_id in action_data:
                    if action_id in ACTION_IDS_TO_CLASSES:
                        missing_qaf_combos.add((ss.asset_id, xpath, action_id))

            ss.content = migrated_content
            to_update.append(ss)
            migrated += 1

            if not dry_run and len(to_update) >= CHUNK_SIZE:
                SubmissionSupplement.objects.bulk_update(to_update, fields=['content'])
                self.stdout.write(f'  Saved {len(to_update)} records...')
                to_update = []

        if not dry_run and to_update:
            SubmissionSupplement.objects.bulk_update(to_update, fields=['content'])
            self.stdout.write(f'  Saved {len(to_update)} records...')

        # Also collect QAF combos from supplements that were already migrated
        # (_version present) but whose asset currently has no QAFs. This handles
        # the case where a previous run was interrupted between the bulk_update
        # and the QAF creation, making the command safely retryable.
        stranded_qs = (
            SubmissionSupplement.objects.filter(content__has_key='_version')
            .exclude(
                Exists(
                    QuestionAdvancedFeature.objects.filter(
                        asset_id=OuterRef('asset_id')
                    )
                )
            )
            .only('asset_id', 'content')
        )
        if asset_uid:
            stranded_qs = stranded_qs.filter(asset__uid=asset_uid)

        for ss in stranded_qs.iterator(chunk_size=CHUNK_SIZE):
            for xpath, action_data in ss.content.items():
                if xpath == '_version' or not isinstance(action_data, dict):
                    continue
                for action_id in action_data:
                    if action_id in ACTION_IDS_TO_CLASSES:
                        missing_qaf_combos.add((ss.asset_id, xpath, action_id))

        if total == 0 and not missing_qaf_combos:
            self.stdout.write(self.style.SUCCESS('Nothing to do.'))
            return

        self._create_missing_qafs(missing_qaf_combos, dry_run)

        if total > 0:
            summary = (
                f'Done. Migrated: {migrated}, Skipped: {skipped}, Errors: {errors}'
            )
            if dry_run:
                summary += ' (dry run — no changes saved)'

            if errors == 0:
                self.stdout.write(self.style.SUCCESS(summary))
            else:
                self.stdout.write(self.style.WARNING(summary))

    def _build_params(self, asset: Asset, xpath: str, action_id: str) -> list | dict:
        """
        Build params for a QuestionAdvancedFeature.

        - manual_qual / automatic_bedrock_qual: extracts question definitions
          from asset.advanced_features['qual']['qual_survey'].
        - manual_transcription / automatic_google_transcription: language list
          from asset.advanced_features['transcript']['languages'].
        - manual_translation / automatic_google_translation: language list
          from asset.advanced_features['translation']['languages'].
        """
        advanced_features = asset.advanced_features or {}

        if action_id in ('manual_transcription', 'automatic_google_transcription'):
            languages = advanced_features.get('transcript', {}).get('languages', [])
            return [{'language': lang} for lang in languages]

        if action_id in ('manual_translation', 'automatic_google_translation'):
            languages = advanced_features.get('translation', {}).get('languages', [])
            return [{'language': lang} for lang in languages]

        if action_id in ('manual_qual', 'automatic_bedrock_qual'):
            qual_survey = advanced_features.get('qual', {}).get('qual_survey', [])
            # qual_survey items may use 'xpath' (slash) or 'qpath' (dash) as the key
            questions = [
                q
                for q in qual_survey
                if q.get('xpath') == xpath or q.get('qpath') == xpath
            ]
            params = []
            for q in questions:
                for required in ('uuid', 'type', 'labels'):
                    if required not in q:
                        raise ValueError(
                            f"qual_survey item missing required field '{required}'"
                        )
                entry = {
                    'uuid': q['uuid'],
                    'type': QUAL_TYPE_MAP.get(q['type'], q['type']),
                    'labels': q['labels'],
                }
                if 'choices' in q:
                    entry['choices'] = [
                        {
                            k: v
                            for k, v in c.items()
                            if k in ('uuid', 'labels', 'options')
                        }
                        for c in q['choices']
                    ]
                if 'options' in q:
                    entry['options'] = q['options']
                params.append(entry)
            return params

        return {}

    def _create_missing_qafs(self, combos: set, dry_run: bool) -> None:
        """
        Create QuestionAdvancedFeature records for (asset_id, xpath, action_id)
        combos present in supplement content but missing from the database.
        """
        if not combos:
            return

        # Filter out combos that already have a QAF
        existing = set(
            QuestionAdvancedFeature.objects.filter(
                asset_id__in={c[0] for c in combos}
            ).values_list('asset_id', 'question_xpath', 'action')
        )
        missing = combos - existing

        if not missing:
            self.stdout.write('No missing QAFs.')
            return

        self.stdout.write(f'Missing QAFs to create: {len(missing)}')

        # Group by asset_id to fetch advanced_features once per asset
        by_asset: dict[int, list] = {}
        for asset_id, xpath, action_id in missing:
            by_asset.setdefault(asset_id, []).append((xpath, action_id))

        qaf_created = 0
        qaf_errors = 0

        assets_by_id = {
            a.pk: a
            for a in Asset.objects.filter(pk__in=by_asset.keys()).defer('content')
        }

        for asset_id, combos_for_asset in by_asset.items():
            asset = assets_by_id.get(asset_id)
            if asset is None:
                self.stderr.write(
                    f'  ERROR: Asset pk={asset_id} not found, skipping'
                    f' {len(combos_for_asset)} combo(s)'
                )
                qaf_errors += len(combos_for_asset)
                continue

            # Wrap all QAFs for this asset in a single transaction so that a
            # partial failure rolls back cleanly. The expanded queryset in
            # handle() will then pick this asset up again on the next run
            # (its supplements have _version but no QAFs).
            asset_qaf_created = 0
            try:
                with transaction.atomic():
                    for xpath, action_id in combos_for_asset:
                        params = self._build_params(asset, xpath, action_id)
                        self.stdout.write(
                            f'  {"[dry-run] " if dry_run else ""}'
                            f'Creating QAF asset={asset.uid}'
                            f' xpath={xpath} action={action_id}'
                        )
                        if not dry_run:
                            _, created = QuestionAdvancedFeature.objects.get_or_create(
                                asset=asset,
                                question_xpath=xpath,
                                action=action_id,
                                defaults={'params': params},
                            )
                            if created:
                                asset_qaf_created += 1
                    if not dry_run:
                        asset.advanced_features['_version'] = SCHEMA_VERSIONS[0]
                        asset.save(
                            update_fields=['advanced_features'],
                            create_version=False,
                            adjust_content=False,
                        )
            except Exception as e:
                self.stderr.write(f'  ERROR creating QAFs for asset={asset.uid}: {e}')
                qaf_errors += len(combos_for_asset)
            else:
                qaf_created += asset_qaf_created

        if not dry_run:
            if qaf_errors:
                raise CommandError(f'QAFs created: {qaf_created}, failed: {qaf_errors}')
            self.stdout.write(f'QAFs created: {qaf_created}')
