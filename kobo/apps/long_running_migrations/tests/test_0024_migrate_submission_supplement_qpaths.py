from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from kobo.apps.subsequences.constants import Action
from kobo.apps.subsequences.models import QuestionAdvancedFeature, SubmissionSupplement
from kpi.models import Asset

from ..models import LongRunningMigration, LongRunningMigrationStatus

# a qpath (dashes) and its xpath (slashes) counterpart for a grouped question
QPATH = 'group-audio'
XPATH = 'group/audio'

QUAL_PARAMS = [
    {
        'labels': {'_default': 'Quality score'},
        'type': 'qualText',
        'uuid': '4dcf9c9f-e503-4e5c-81f5-74250b295001',
    }
]


@override_settings(
    CACHES={'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}}
)
class Migrate0024QpathsTestCase(TestCase):
    def setUp(self):
        # The data migrations already insert these rows into the test DB, so
        # reuse them rather than creating (which would violate the name unique
        # constraint). 0024 checks that its predecessor 0023 is complete.
        LongRunningMigration.objects.update_or_create(
            name='0023_migrate_submission_supplements',
            defaults={'status': LongRunningMigrationStatus.COMPLETED},
        )
        self.migration, _ = LongRunningMigration.objects.update_or_create(
            name='0024_migrate_submission_supplement_qpaths',
            defaults={
                'status': LongRunningMigrationStatus.CREATED,
                'error': None,
                'attempts': 0,
            },
        )
        self.owner = get_user_model().objects.create(username='nlp_owner')

    def _make_asset(self):
        # Create with a normal survey (so content adjustment is happy), then
        # overwrite the content raw with `adjust_content=False` — otherwise
        # `save()` regenerates `$xpath` from the label and drops the legacy
        # `$qpath` we need to reproduce the migration's input.
        asset = Asset.objects.create(
            owner=self.owner,
            content={'survey': [{'type': 'audio', 'name': 'story', 'label': ['S']}]},
            advanced_features={'_version': 'v1', 'qual': {'qual_survey': []}},
        )
        asset.content = {
            'schema': '1',
            'settings': {},
            'survey': [
                {
                    'type': 'audio',
                    'label': ['Tell me a story!'],
                    '$qpath': QPATH,
                    '$xpath': XPATH,
                }
            ],
        }
        asset.save(adjust_content=False)
        return asset

    def _make_supplement(self, asset, content):
        return SubmissionSupplement.objects.create(
            submission_uuid=f'sub-{asset.uid}',
            asset=asset,
            content=content,
        )

    def test_qpath_key_is_migrated_to_xpath(self):
        asset = self._make_asset()
        # the feature already exists, so get_or_create just finds it
        QuestionAdvancedFeature.objects.create(
            asset=asset,
            question_xpath=XPATH,
            action=Action.MANUAL_QUAL,
            params=QUAL_PARAMS,
        )
        supplement = self._make_supplement(
            asset,
            {'_version': '20250820', QPATH: {Action.MANUAL_QUAL: {'value': 'x'}}},
        )

        self.migration.execute()

        self.migration.refresh_from_db()
        self.assertEqual(self.migration.status, LongRunningMigrationStatus.COMPLETED)
        supplement.refresh_from_db()
        self.assertIn(XPATH, supplement.content)
        self.assertNotIn(QPATH, supplement.content)

    def test_bare_googlets_is_converted_to_automatic_google_transcription(self):
        # The real prod failure: a supplement carrying the pre-migration action
        # ID 'googlets' made get_or_create -> QAF.save() raise `KeyError:
        # 'googlets'` and abort the whole migration. A bare 'googlets' (no
        # 'transcript') is now rebuilt into 'automatic_google_transcription'
        # rather than skipped, so the transcription data is preserved.
        asset = self._make_asset()
        supplement = self._make_supplement(
            asset,
            {
                '_version': '20250820',
                QPATH: {
                    'googlets': {
                        'languageCode': 'en',
                        'value': 'hello there',
                        'status': 'complete',
                    }
                },
            },
        )

        self.migration.execute()

        self.migration.refresh_from_db()
        self.assertEqual(self.migration.status, LongRunningMigrationStatus.COMPLETED)
        supplement.refresh_from_db()
        content = supplement.content
        # outer qpath -> xpath rewrite happened, legacy key is gone
        self.assertIn(XPATH, content)
        self.assertNotIn(QPATH, content)
        self.assertNotIn('googlets', content[XPATH])
        # the automatic transcription is preserved under the new action ID
        auto = content[XPATH]['automatic_google_transcription']
        self.assertEqual(auto['_versions'][0]['_data']['value'], 'hello there')
        self.assertEqual(auto['_versions'][0]['_data']['language'], 'en')
        # and its QuestionAdvancedFeature was created under the new action ID
        self.assertTrue(
            QuestionAdvancedFeature.objects.filter(
                asset=asset,
                question_xpath=XPATH,
                action='automatic_google_transcription',
            ).exists()
        )

    def test_googlets_with_transcript_converts_manual_and_automatic(self):
        # googlets (automatic result) + transcript (manual history) go through
        # the canonical converter: the manual text becomes manual_transcription,
        # and the automatic result becomes automatic_google_transcription.
        asset = self._make_asset()
        supplement = self._make_supplement(
            asset,
            {
                '_version': '20250820',
                QPATH: {
                    'googlets': {
                        'languageCode': 'en',
                        'value': 'auto text',
                        'status': 'complete',
                    },
                    'transcript': {
                        'languageCode': 'en',
                        'value': 'manual text',
                        'dateModified': '2025-01-01T00:00:00Z',
                        'revisions': [],
                    },
                },
            },
        )

        self.migration.execute()

        self.migration.refresh_from_db()
        self.assertEqual(self.migration.status, LongRunningMigrationStatus.COMPLETED)
        supplement.refresh_from_db()
        actions = supplement.content[XPATH]
        self.assertNotIn('googlets', actions)
        self.assertNotIn('transcript', actions)
        self.assertEqual(
            actions['manual_transcription']['_versions'][0]['_data']['value'],
            'manual text',
        )
        self.assertEqual(
            actions['automatic_google_transcription']['_versions'][0]['_data']['value'],
            'auto text',
        )
