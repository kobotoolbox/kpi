import copy
import itertools
from unittest.mock import patch

from django.test import TestCase

from kobo.apps.subsequences.constants import Action
from kobo.apps.subsequences.tests.constants import OLD_STYLE_ADVANCED_FEATURES
from kobo.apps.subsequences.utils.versioning import (
    convert_nlp_params,
    convert_qual_params,
    migrate_advanced_features,
)
from kpi.models import Asset


class TestVersioning(TestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.asset = Asset.objects.get(id=1)
        # cheat to avoid automatic migration from asset.save()
        Asset.objects.filter(pk=1).update(
            advanced_features=OLD_STYLE_ADVANCED_FEATURES,
            known_cols=['q1:transcription:en', 'q2:translation:es'],
        )
        self.asset.refresh_from_db()

    def _check_expected_params(
        self,
        param_dict,
        expected_type,
        expected_label,
        expected_uuid,
        expected_choices=None,
    ):
        assert param_dict['type'] == expected_type
        assert param_dict['labels'] == {'_default': expected_label}
        assert param_dict['uuid'] == expected_uuid
        assert param_dict.get('choices') == expected_choices

    def test_migrate_is_non_destructive(self):
        copied = copy.deepcopy(self.asset.advanced_features)
        migrate_advanced_features(self.asset)
        self.asset.refresh_from_db()
        assert self.asset.advanced_features == {
            '_version': '20250820',
            **copied
        }

    def test_migrate_without_save(self):
        migrate_advanced_features(self.asset, save_asset=False)
        assert self.asset.advanced_features.get('_version') == '20250820'
        self.asset.refresh_from_db()
        assert self.asset.advanced_features.get('_version') is None

    def test_convert_nlp_action(self):
        transcript_dict = {'languages': ['en', 'es']}
        known_cols_list = ['Audio_q_1', 'Audio_q_2']
        known_cols_set = set(known_cols_list)
        features = convert_nlp_params(
            self.asset,
            transcript_dict,
            known_cols_set,
            Action.MANUAL_TRANSCRIPTION,
            Action.AUTOMATIC_GOOGLE_TRANSCRIPTION,
        )
        features.sort(key=lambda x: f'{x.question_xpath}-{x.action}')
        assert len(features) == 4
        combinations = itertools.product(
            known_cols_list,
            [Action.AUTOMATIC_GOOGLE_TRANSCRIPTION, Action.MANUAL_TRANSCRIPTION],
        )
        for index, (xpath, action) in enumerate(combinations):
            assert features[index].question_xpath == xpath
            assert features[index].action == action
            assert features[index].params == [{'language': 'en'}, {'language': 'es'}]

    def test_convert_qual_params(self):
        qualdict = {
            'qual_survey': [
                {
                    'uuid': 'q1',
                    'xpath': '/a',
                    'type': 'qual_text',
                    'labels': {'_default': 'A1'},
                },
                {
                    'uuid': 'q2',
                    'xpath': '/a',
                    'type': 'qual_text',
                    'labels': {'_default': 'A2'},
                },
                {
                    'uuid': 'q3',
                    'xpath': '/b',
                    'type': 'qual_integer',
                    'labels': {'_default': 'B1'},
                },
            ]
        }

        created = convert_qual_params(self.asset, qualdict)
        created.sort(key=lambda x: x.question_xpath)

        # Two different xpaths will create two DB rows
        self.assertEqual(len(created), 2)

        qa_a = created[0]
        assert qa_a.question_xpath == '/a'
        assert len(qa_a.params) == 2
        assert {p['uuid'] for p in qa_a.params} == {'q1', 'q2'}

        qa_b = created[1]
        assert len(qa_b.params) == 1
        assert qa_b.params[0]['uuid'] == 'q3'

    def test_convert_qual_params_invalid(self):

        # empty dict
        res = convert_qual_params(self.asset, {})
        self.assertEqual(res, [])

        # malformed qual_survey
        res = convert_qual_params(self.asset, {'qual_survey': 'not-a-list'})
        self.assertEqual(res, [])

    def test_full_migration(self):
        migrate_advanced_features(self.asset)
        self.asset.refresh_from_db()
        all_asset_advanced_features = self.asset.advanced_features_set
        expected_xpaths = ['q1', 'q2']
        # (4 nlp actions * 2 questions) + (1 qual action * 2 questions)
        assert all_asset_advanced_features.count() == 10

        # transcriptions - English only
        expected_actions = [
            Action.AUTOMATIC_GOOGLE_TRANSCRIPTION,
            Action.MANUAL_TRANSCRIPTION,
        ]
        for xpath, action in itertools.product(expected_xpaths, expected_actions):
            assert all_asset_advanced_features.filter(
                question_xpath=xpath, action=action, params=[{'language': 'en'}]
            ).exists()

        # translations - Spanish only
        expected_actions = [
            Action.AUTOMATIC_GOOGLE_TRANSLATION,
            Action.MANUAL_TRANSLATION,
        ]
        for xpath, action in itertools.product(expected_xpaths, expected_actions):
            assert all_asset_advanced_features.filter(
                question_xpath=xpath, action=action, params=[{'language': 'es'}]
            ).exists()

        # qual
        for q in ['q1', 'q2']:
            qaf = all_asset_advanced_features.get(action='qual', question_xpath=q)
            params = qaf.params
            params.sort(key=lambda x: x['type'])
            # qual_integer
            self._check_expected_params(
                params[0],
                expected_type='qualInteger',
                expected_label='Integer?',
                expected_uuid=f'qual_integer_{q}',
            )
            # qual_note
            self._check_expected_params(
                params[1],
                expected_type='qualNote',
                expected_label='Note',
                expected_uuid=f'qual_note_{q}',
            )
            # qual_select_multiple
            self._check_expected_params(
                params[2],
                expected_type='qualSelectMultiple',
                expected_label='Multiple?',
                expected_uuid=f'qual_select_multiple_{q}',
                expected_choices=[
                    {'labels': {'_default': 'Green'}, 'uuid': f'green_{q}'},
                    {'labels': {'_default': 'Red'}, 'uuid': f'red_{q}'},
                    {'labels': {'_default': 'Blue'}, 'uuid': f'blue_{q}'},
                ],
            )
            # qual_select_one
            self._check_expected_params(
                params[3],
                expected_type='qualSelectOne',
                expected_label='Single?',
                expected_uuid=f'qual_select_one_{q}',
                expected_choices=[
                    {'labels': {'_default': 'A'}, 'uuid': f'a_{q}'},
                    {'labels': {'_default': 'B'}, 'uuid': f'b_{q}'},
                ],
            )

            # qual_tags
            self._check_expected_params(
                params[4],
                expected_type='qualTags',
                expected_label='Tags?',
                expected_uuid=f'qual_tags_{q}',
            )

            # qual_text
            self._check_expected_params(
                params[5],
                expected_type='qualText',
                expected_label='Text?',
                expected_uuid=f'qual_text_{q}',
            )

    def test_saving_asset_only_calls_migrate_once(self):
        with patch('kpi.models.asset.migrate_advanced_features') as migrate:
            self.asset.save(adjust_content=False)
        migrate.assert_called_once_with(self.asset, save_asset=False)
