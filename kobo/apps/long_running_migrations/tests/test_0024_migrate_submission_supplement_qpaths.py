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
        asset.save(adjust_content=False, create_version=False)
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

    def test_legacy_googlets_action_is_skipped_not_fatal(self):
        # Reproduces the real prod failure: a supplement still carrying the
        # pre-migration action ID 'googlets' made get_or_create -> QAF.save()
        # raise `KeyError: 'googlets'` and abort the whole migration. The action
        # is now skipped, and the qpath key is still rewritten to its xpath.
        asset = self._make_asset()
        supplement = self._make_supplement(
            asset,
            {'_version': '20250820', QPATH: {'googlets': {'value': 'x'}}},
        )

        self.migration.execute()

        self.migration.refresh_from_db()
        self.assertEqual(self.migration.status, LongRunningMigrationStatus.COMPLETED)
        supplement.refresh_from_db()
        # outer qpath -> xpath rewrite still happened despite the legacy action
        self.assertIn(XPATH, supplement.content)
        self.assertNotIn(QPATH, supplement.content)
        # no QuestionAdvancedFeature was created for the unknown legacy action
        self.assertFalse(
            QuestionAdvancedFeature.objects.filter(action='googlets').exists()
        )
