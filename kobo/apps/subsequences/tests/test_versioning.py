import copy
import itertools
from datetime import datetime, timedelta
from unittest.mock import patch

from ddt import data, ddt, unpack
from django.test import TestCase
from django.utils import timezone
from freezegun import freeze_time

from kobo.apps.subsequences.constants import Action
from kobo.apps.subsequences.tests.constants import (
    CHOICE_A_Q1_UUID,
    CHOICE_A_Q2_UUID,
    CHOICE_B_Q1_UUID,
    CHOICE_B_Q2_UUID,
    CHOICE_BLUE_Q1_UUID,
    CHOICE_BLUE_Q2_UUID,
    CHOICE_GREEN_Q1_UUID,
    CHOICE_GREEN_Q2_UUID,
    CHOICE_RED_Q1_UUID,
    CHOICE_RED_Q2_UUID,
    OLD_STYLE_ADVANCED_FEATURES,
    QUAL_INTEGER_Q1_UUID,
    QUAL_INTEGER_Q2_UUID,
    QUAL_NOTE_Q1_UUID,
    QUAL_NOTE_Q2_UUID,
    QUAL_SELECT_MULTIPLE_Q1_UUID,
    QUAL_SELECT_MULTIPLE_Q2_UUID,
    QUAL_SELECT_ONE_Q1_UUID,
    QUAL_SELECT_ONE_Q2_UUID,
    QUAL_TAGS_Q1_UUID,
    QUAL_TAGS_Q2_UUID,
    QUAL_TEXT_Q1_UUID,
    QUAL_TEXT_Q2_UUID,
    VERSIONING_QUAL_A1_UUID,
    VERSIONING_QUAL_A2_UUID,
    VERSIONING_QUAL_B1_UUID,
    VERSIONING_QUAL_INTEGER_UUID,
    VERSIONING_QUAL_TEXT_UUID,
)
from kobo.apps.subsequences.utils.versioning import (
    _determine_source_transcript,
    _new_revision_from_old,
    _separate_manual_and_automatic_versions,
    convert_nlp_params,
    convert_qual_params,
    migrate_advanced_features,
    migrate_submission_supplementals,
)
from kpi.models import Asset


@ddt
class TestVersioning(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        super().setUp()

        self.asset = Asset.objects.get(id=1)
        # cheat to avoid automatic migration from asset.save()
        Asset.objects.filter(pk=1).update(
            advanced_features=OLD_STYLE_ADVANCED_FEATURES,
            known_cols=['q1:transcription:en', 'q2:translation:es'],
        )
        self.asset.refresh_from_db()

        # works for translations or transcriptions
        self.now = timezone.now().isoformat()
        self.yesterday = (timezone.now() - timedelta(days=1)).isoformat()
        self.action_dict = {
            'dateCreated': None,
            'dateModified': self.now,
            'languageCode': 'en',
            'revisions': [
                {
                    'dateModified': self.yesterday,
                    'languageCode': 'en',
                    'value': 'Old value',
                }
            ],
            'value': 'Latest value',
        }

    def test_new_revision_from_old(self):
        now = timezone.now()
        old = {
            'dateCreated': None,
            'dateModified': '2025-10-22 17:09:38',
            'languageCode': 'en',
            'value': 'Transcribed new',
        }
        with freeze_time(now):
            result = _new_revision_from_old(old)
        assert result['_data']['value'] == old['value']
        assert result['_data']['language'] == old['languageCode']
        assert result['_dateCreated'] == old['dateModified']
        assert result['_uuid'] is not None
        assert result['_dateAccepted'] == now.isoformat()

    def test_new_transcript_revision_from_old_returns_none_for_bad_data(self):
        old = {'badly': 'formatted'}
        assert _new_revision_from_old(old) is None

    @data(True, False)
    def test_separate_automatic_and_manual(self, latest_is_automated):
        automated_transcription_value = (
            'Latest value' if latest_is_automated else 'Old value'
        )
        manual, automated = _separate_manual_and_automatic_versions(
            self.action_dict, 'en', automated_transcription_value
        )
        new_automated_transcript = automated[0]
        new_manual_transcript = manual[0]
        expected_most_recent_transcript = (
            new_automated_transcript if latest_is_automated else new_manual_transcript
        )
        expected_old_transcript = (
            new_manual_transcript if latest_is_automated else new_automated_transcript
        )

        assert expected_most_recent_transcript['_dateCreated'] == self.now
        assert expected_most_recent_transcript['_data']['value'] == 'Latest value'
        assert expected_old_transcript['_dateCreated'] == self.yesterday
        assert expected_old_transcript['_data']['value'] == 'Old value'

    def test_separate_automatic_and_manual_forces_language_if_given(self):
        manual, automated = _separate_manual_and_automatic_versions(
            self.action_dict, None, None, language='en'
        )
        for formatted_item in manual:
            assert formatted_item['_data']['language'] == 'en'

    def test_separate_automatic_and_manual_without_automatic_value(self):
        manual, automatic = _separate_manual_and_automatic_versions(
            self.action_dict, None, None
        )
        assert len(manual) == 2
        assert len(automatic) == 0

    @data(
        # known language, date created, expected result uuid
        # there is a transcript of the same language with an older date
        ('de', '2024-12-31', 'uuid4'),
        # there are transcripts of the same language but none older than the translation
        ('de', '2023-01-01', 'uuid3'),
        # there are no transcripts of the same language
        ('fr', '2024-12-31', 'uuid1'),
        # we don't know the source language but there are older transcripts
        (None, '2024-12-31', 'uuid2'),
        # we don't know the source language and there are no older transcripts
        (None, '2023-01-01', 'uuid1'),
    )
    @unpack
    def test_determine_source_transcription(
        self, source_language, date_created, expected_source_uuid
    ):
        now = timezone.now()
        one_day_ago = now - timedelta(days=1)
        jan_1_2024 = datetime(2024, 1, 1, tzinfo=timezone.utc)
        jan_2_2024 = datetime(2024, 1, 2, tzinfo=timezone.utc)
        transcripts = [
            {
                '_uuid': 'uuid1',
                '_dateCreated': now.isoformat(),
                '_data': {'language': 'en'},
                '_actionId': 'manual_transcription',
            },
            {
                '_uuid': 'uuid2',
                '_dateCreated': jan_1_2024.isoformat(),
                '_data': {'language': 'en'},
                '_actionId': 'automatic_transcription',
            },
            {
                '_uuid': 'uuid3',
                '_dateCreated': one_day_ago.isoformat(),
                '_data': {'language': 'de'},
                '_actionId': 'manual_transcription',
            },
            {
                '_uuid': 'uuid4',
                '_dateCreated': jan_2_2024.isoformat(),
                '_data': {'language': 'de'},
                '_actionId': 'automatic_transcription',
            },
        ]
        translation_revision = {'_dateCreated': date_created}
        source_transcript = _determine_source_transcript(
            translation_revision, transcripts, automatic_source_language=source_language
        )
        assert source_transcript['_uuid'] == expected_source_uuid

    # test the whole transformation process
    def test_migrate_submission_extra_to_supplemental(self):
        now = timezone.now()
        one_day_ago = (now - timedelta(days=1)).isoformat()
        one_year_ago = (now - timedelta(days=365)).isoformat()
        a_year_and_a_day_ago = (now - timedelta(days=366)).isoformat()
        old_version = {
            'Audio_question': {
                'googlets': {
                    'languageCode': 'en',
                    'regionCode': None,
                    'status': 'complete',
                    'value': 'This is audio that I am trying to ' 'transcribe.',
                },
                'googletx': {
                    'languageCode': 'es',
                    'source': 'en',
                    'status': 'complete',
                    'value': 'Esto es un audio que estoy ' 'intentando a transcribir.',
                },
                'transcript': {
                    'dateCreated': one_day_ago,
                    'dateModified': one_day_ago,
                    'languageCode': 'en',
                    'revisions': [
                        {
                            'dateModified': a_year_and_a_day_ago,
                            'languageCode': 'en',
                            'value': 'This is audio that '
                            'I am trying to '
                            'transcribe.',
                        },
                        {},
                    ],
                    'value': 'This is audio that I am trying to '
                    'transcribe but i edited it.',
                },
                'translation': {
                    'es': {
                        'dateCreated': one_year_ago,
                        'dateModified': now.isoformat(),
                        'languageCode': 'es',
                        'revisions': [
                            {
                                'dateModified': one_year_ago,
                                'languageCode': 'es',
                                'value': 'Esto es un '
                                'audio que '
                                'estoy '
                                'intentando a '
                                'transcribir.',
                            }
                        ],
                        'value': 'Esto es un audio que '
                        'estoy intentando '
                        'transcribir pero yo lo edité',
                    }
                },
                'qual': [
                    {
                        'val': 'music123',
                        'type': 'qual_text',
                        'uuid': VERSIONING_QUAL_TEXT_UUID,
                    },
                    {
                        'val': 2,
                        'type': 'qual_integer',
                        'uuid': VERSIONING_QUAL_INTEGER_UUID,
                    },
                ],
            }
        }

        with patch(
            'kobo.apps.subsequences.utils.versioning.uuid.uuid4',
            side_effect=['uuid1', 'uuid2', 'uuid3', 'uuid4', 'uuid5', 'uuid6'],
        ):
            with freeze_time(now):
                migrated = migrate_submission_supplementals(old_version)

        new_version = {
            '_version': '20250820',
            'Audio_question': {
                'automatic_google_transcription': {
                    '_dateCreated': a_year_and_a_day_ago,
                    '_dateModified': a_year_and_a_day_ago,
                    '_versions': [
                        {
                            '_dateCreated': a_year_and_a_day_ago,
                            '_dateAccepted': now.isoformat(),
                            '_uuid': 'uuid2',
                            '_data': {
                                'language': 'en',
                                'value': 'This is audio that I am trying to transcribe.',  # noqa
                                'status': 'complete',
                            },
                        }
                    ],
                },
                'automatic_google_translation': {
                    'es': {
                        '_dateCreated': one_year_ago,
                        '_dateModified': one_year_ago,
                        '_versions': [
                            {
                                '_dateCreated': one_year_ago,
                                '_dateAccepted': now.isoformat(),
                                '_dependency': {
                                    '_actionId': 'automatic_google_transcription',
                                    '_uuid': 'uuid2',
                                },
                                '_uuid': 'uuid4',
                                '_data': {
                                    'language': 'es',
                                    'value': 'Esto es un audio que estoy intentando a'
                                    ' transcribir.',
                                    'status': 'complete',
                                },
                            }
                        ],
                    }
                },
                'manual_transcription': {
                    '_dateCreated': one_day_ago,
                    '_dateModified': one_day_ago,
                    '_versions': [
                        {
                            '_dateCreated': one_day_ago,
                            '_dateAccepted': now.isoformat(),
                            '_uuid': 'uuid1',
                            '_data': {
                                'language': 'en',
                                'value': 'This is audio that I am trying to '
                                'transcribe but i edited it.',
                            },
                        }
                    ],
                },
                'manual_translation': {
                    'es': {
                        '_dateCreated': now.isoformat(),
                        '_dateModified': now.isoformat(),
                        '_versions': [
                            {
                                '_dateCreated': now.isoformat(),
                                '_dateAccepted': now.isoformat(),
                                '_dependency': {
                                    '_actionId': 'manual_transcription',
                                    '_uuid': 'uuid1',
                                },
                                '_uuid': 'uuid3',
                                '_data': {
                                    'language': 'es',
                                    'value': 'Esto es un audio que estoy intentando'
                                    ' transcribir pero yo lo edité',
                                },
                            }
                        ],
                    }
                },
                'manual_qual': {
                    VERSIONING_QUAL_TEXT_UUID: {
                        '_dateCreated': now.isoformat(),
                        '_dateModified': now.isoformat(),
                        '_versions': [
                            {
                                '_data': {
                                    'uuid': VERSIONING_QUAL_TEXT_UUID,
                                    'value': 'music123',
                                },
                                '_dateCreated': now.isoformat(),
                                '_dateAccepted': now.isoformat(),
                                '_uuid': 'uuid5',
                            }
                        ],
                    },
                    VERSIONING_QUAL_INTEGER_UUID: {
                        '_dateCreated': now.isoformat(),
                        '_dateModified': now.isoformat(),
                        '_versions': [
                            {
                                '_data': {
                                    'uuid': VERSIONING_QUAL_INTEGER_UUID,
                                    'value': 2,
                                },
                                '_dateCreated': now.isoformat(),
                                '_dateAccepted': now.isoformat(),
                                '_uuid': 'uuid6',
                            }
                        ],
                    },
                },
            },
        }
        assert migrated == new_version

    def test_migrate_is_non_destructive(self):
        copied = copy.deepcopy(self.asset.advanced_features)
        migrate_advanced_features(self.asset)
        self.asset.refresh_from_db()
        assert self.asset.advanced_features == {'_version': '20250820', **copied}

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
                    'uuid': VERSIONING_QUAL_A1_UUID,
                    'xpath': '/a',
                    'type': 'qual_text',
                    'labels': {'_default': 'A1'},
                },
                {
                    'uuid': VERSIONING_QUAL_A2_UUID,
                    'xpath': '/a',
                    'type': 'qual_text',
                    'labels': {'_default': 'A2'},
                },
                {
                    'uuid': VERSIONING_QUAL_B1_UUID,
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
        assert {p['uuid'] for p in qa_a.params} == {
            VERSIONING_QUAL_A1_UUID,
            VERSIONING_QUAL_A2_UUID,
        }

        qa_b = created[1]
        assert len(qa_b.params) == 1
        assert qa_b.params[0]['uuid'] == VERSIONING_QUAL_B1_UUID

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
        q1_q2_uuids = [
            {
                'integer': QUAL_INTEGER_Q1_UUID,
                'note': QUAL_NOTE_Q1_UUID,
                'select_multiple': QUAL_SELECT_MULTIPLE_Q1_UUID,
                'select_one': QUAL_SELECT_ONE_Q1_UUID,
                'tags': QUAL_TAGS_Q1_UUID,
                'text': QUAL_TEXT_Q1_UUID,
                'choice_green': CHOICE_GREEN_Q1_UUID,
                'choice_red': CHOICE_RED_Q1_UUID,
                'choice_blue': CHOICE_BLUE_Q1_UUID,
                'choice_a': CHOICE_A_Q1_UUID,
                'choice_b': CHOICE_B_Q1_UUID,
            },
            {
                'integer': QUAL_INTEGER_Q2_UUID,
                'note': QUAL_NOTE_Q2_UUID,
                'select_multiple': QUAL_SELECT_MULTIPLE_Q2_UUID,
                'select_one': QUAL_SELECT_ONE_Q2_UUID,
                'tags': QUAL_TAGS_Q2_UUID,
                'text': QUAL_TEXT_Q2_UUID,
                'choice_green': CHOICE_GREEN_Q2_UUID,
                'choice_red': CHOICE_RED_Q2_UUID,
                'choice_blue': CHOICE_BLUE_Q2_UUID,
                'choice_a': CHOICE_A_Q2_UUID,
                'choice_b': CHOICE_B_Q2_UUID,
            },
        ]
        for idx, q in enumerate(['q1', 'q2']):
            uuids = q1_q2_uuids[idx]
            qaf = all_asset_advanced_features.get(
                action=Action.MANUAL_QUAL, question_xpath=q
            )
            params = qaf.params
            params.sort(key=lambda x: x['type'])
            # qual_integer
            self._check_expected_params(
                params[0],
                expected_type='qualInteger',
                expected_label='Integer?',
                expected_uuid=uuids['integer'],
            )
            # qual_note
            self._check_expected_params(
                params[1],
                expected_type='qualNote',
                expected_label='Note',
                expected_uuid=uuids['note'],
            )
            # qual_select_multiple
            self._check_expected_params(
                params[2],
                expected_type='qualSelectMultiple',
                expected_label='Multiple?',
                expected_uuid=uuids['select_multiple'],
                expected_choices=[
                    {
                        'labels': {'_default': 'Green'},
                        'uuid': uuids['choice_green'],
                    },
                    {
                        'labels': {'_default': 'Red'},
                        'uuid': uuids['choice_red'],
                    },
                    {
                        'labels': {'_default': 'Blue'},
                        'uuid': uuids['choice_blue'],
                    },
                ],
            )
            # qual_select_one
            self._check_expected_params(
                params[3],
                expected_type='qualSelectOne',
                expected_label='Single?',
                expected_uuid=uuids['select_one'],
                expected_choices=[
                    {
                        'labels': {'_default': 'A'},
                        'uuid': uuids['choice_a'],
                    },
                    {
                        'labels': {'_default': 'B'},
                        'uuid': uuids['choice_b'],
                    },
                ],
            )

            # qual_tags
            self._check_expected_params(
                params[4],
                expected_type='qualTags',
                expected_label='Tags?',
                expected_uuid=uuids['tags'],
            )

            # qual_text
            self._check_expected_params(
                params[5],
                expected_type='qualText',
                expected_label='Text?',
                expected_uuid=uuids['text'],
            )

    def test_saving_asset_only_calls_migrate_once(self):
        with patch('kpi.models.asset.migrate_advanced_features') as migrate:
            self.asset.save(adjust_content=False)
        migrate.assert_called_once_with(self.asset, save_asset=False)

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
