import uuid
from copy import deepcopy
from datetime import datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

import pytest
from django.test import TestCase
from freezegun import freeze_time

from kobo.apps.kobo_auth.shortcuts import User
from kpi.models import Asset
from ..actions import (
    AutomaticGoogleTranscriptionAction,
    AutomaticGoogleTranslationAction,
)
from ..constants import SUBMISSION_UUID_FIELD
from ..exceptions import InvalidAction, InvalidXPath
from ..models import QuestionAdvancedFeature, SubmissionSupplement
from .constants import EMPTY_SUPPLEMENT


class MockNLPService:
    def __init__(self, submission, asset, *args, **kwargs):
        self.submission = submission
        self.asset = asset

    def process_data(self, *args, **kwargs):
        pass


class SubmissionSupplementTestCase(TestCase):

    EXPECTED_SUBMISSION_SUPPLEMENT = {
        '_version': '20250820',
        'group_name/question_name': {
            'manual_transcription': {
                '_dateCreated': '2024-04-08T15:27:00Z',
                '_dateModified': '2024-04-08T15:31:00Z',
                '_versions': [
                    {
                        '_data': {
                            'language': 'ar',
                            'value': 'مجنون',
                        },
                        '_dateCreated': '2024-04-08T15:31:00Z',
                        '_dateAccepted': '2024-04-08T15:31:00Z',
                        '_uuid': '51ff33a5-62d6-48ec-94b2-2dfb406e1dee',
                    },
                    {
                        '_data': {
                            'language': 'ar',
                            'value': 'هائج',
                        },
                        '_dateCreated': '2024-04-08T15:27:00Z',
                        '_dateAccepted': '2024-04-08T15:27:00Z',
                        '_uuid': '123e4567-e89b-12d3-a456-426614174000',
                    },
                ],
            },
            'manual_translation': {
                'en': {
                    '_dateCreated': '2024-04-08T15:27:00Z',
                    '_dateModified': '2024-04-08T15:27:00Z',
                    '_versions': [
                        {
                            '_data': {
                                'language': 'en',
                                'value': 'berserk',
                            },
                            '_dateCreated': '2024-04-08T15:27:00Z',
                            '_dateAccepted': '2024-04-08T15:27:00Z',
                            '_uuid': '22b04ce8-61c2-4383-836f-5d5f0ad73645',
                            '_dependency': {
                                '_uuid': '123e4567-e89b-12d3-a456-426614174000',
                                '_actionId': 'manual_transcription',
                            },
                        }
                    ],
                },
                'es': {
                    '_dateCreated': '2024-04-08T15:29:00Z',
                    '_dateModified': '2024-04-08T15:32:00Z',
                    '_versions': [
                        {
                            '_data': {
                                'language': 'es',
                                'value': 'enloquecido',
                            },
                            '_dateCreated': '2024-04-08T15:32:00Z',
                            '_dateAccepted': '2024-04-08T15:32:00Z',
                            '_uuid': 'd69b9263-04fd-45b4-b011-2e166cfefd4a',
                            '_dependency': {
                                '_uuid': '51ff33a5-62d6-48ec-94b2-2dfb406e1dee',
                                '_actionId': 'manual_transcription',
                            },
                        },
                        {
                            '_data': {
                                'language': 'es',
                                'value': 'loco',
                            },
                            '_dateCreated': '2024-04-08T15:29:00Z',
                            '_dateAccepted': '2024-04-08T15:29:00Z',
                            '_uuid': '30d0f39c-a1dd-43fe-999a-844f12f83d31',
                            '_dependency': {
                                '_uuid': '123e4567-e89b-12d3-a456-426614174000',
                                '_actionId': 'manual_transcription',
                            },
                        },
                    ],
                },
            },
        },
    }

    def setUp(self):
        # Create owner user
        self.owner = User.objects.create_user(
            username='alice',
            email='alice@example.com',
            password='password',
        )

        # Create Asset with minimal advanced_features
        self.asset = Asset.objects.create(
            owner=self.owner,
            name='Test Asset',
        )
        self.xpath = 'group_name/question_name'
        QuestionAdvancedFeature.objects.create(
            question_xpath=self.xpath,
            action='manual_transcription',
            params=[{'language': 'en'}],
            asset=self.asset,
        )
        QuestionAdvancedFeature.objects.create(
            question_xpath=self.xpath,
            action='manual_translation',
            params=[{'language': 'fr'}, {'language': 'es'}],
            asset=self.asset,
        )

        # Mock submission with minimal info needed for subsequence actions
        self.submission_root_uuid = '123e4567-e89b-12d3-a456-426614174000'
        self.submission = {
            SUBMISSION_UUID_FIELD: self.submission_root_uuid,
            self.xpath: 'audio.m4a',
        }

    def _add_manual_nlp_action(
        self,
        nlp_action: str,
        language: str,
        value: str,
    ):
        SubmissionSupplement.revise_data(
            self.asset,
            self.submission,
            incoming_data={
                '_version': '20250820',
                self.xpath: {
                    f'manual_{nlp_action}': {'language': language, 'value': value}
                },
            },
        )

    def _add_automatic_nlp_action(
        self, nlp_action: str, language: str, value: str, accept=False
    ):
        service = (
            AutomaticGoogleTranscriptionAction
            if nlp_action == 'transcription'
            else AutomaticGoogleTranslationAction
        )
        with patch.object(
            MockNLPService,
            'process_data',
            return_value={'value': value, 'status': 'complete'},
        ):
            with patch.object(
                service, 'get_nlp_service_class', return_value=MockNLPService
            ):
                SubmissionSupplement.revise_data(
                    self.asset,
                    self.submission,
                    incoming_data={
                        '_version': '20250820',
                        self.xpath: {
                            f'automatic_google_{nlp_action}': {'language': language}
                        },
                    },
                )
                if accept:
                    SubmissionSupplement.revise_data(
                        self.asset,
                        self.submission,
                        incoming_data={
                            '_version': '20250820',
                            self.xpath: {
                                f'automatic_google_{nlp_action}': {
                                    'language': language,
                                    'accepted': True,
                                }
                            },
                        },
                    )

    def _enable_nlp_action(self, action: str, languages: list[str]):
        feature, _ = QuestionAdvancedFeature.objects.get_or_create(
            asset=self.asset,
            action=action,
            question_xpath=self.xpath,
            defaults={'params': []},
        )
        for lang in languages:
            if {'language': lang} not in feature.params:
                feature.params.append({'language': lang})
        feature.save()

    def test_retrieve_empty_data(self):
        assert (
            SubmissionSupplement.retrieve_data(self.asset, self.submission_root_uuid)
            == EMPTY_SUPPLEMENT
        )

    def test_retrieve_data_with_invalid_arguments(self):
        with pytest.raises(ValueError):
            SubmissionSupplement.retrieve_data(
                self.asset, submission_root_uuid=None, prefetched_supplement=None
            )

    def test_retrieve_data_for_output_does_not_return_unaccepted_answer(self):
        self._add_manual_nlp_action('transcription', 'en', 'Hello')
        self._add_manual_nlp_action('translation', 'es', 'Hola')
        ss = SubmissionSupplement.objects.get(
            asset=self.asset, submission_uuid=self.submission_root_uuid
        )
        # clear date accepted
        ss.content[self.xpath]['manual_transcription']['_versions'][0][
            '_dateAccepted'
        ] = None
        ss.content[self.xpath]['manual_translation']['es']['_versions'][0][
            '_dateAccepted'
        ] = None
        ss.save()

        output = SubmissionSupplement.retrieve_data(
            self.asset, self.submission_root_uuid, for_output=True
        )
        transcription_data = output[self.xpath].get('transcript')
        translation_data = output[self.xpath].get('translation')
        assert transcription_data is None
        assert translation_data is None

    def test_retrieve_data_for_output_selects_most_recent_transcript(self):
        # Enable manual transcriptions in French
        self._enable_nlp_action('manual_transcription', ['fr'])
        self._enable_nlp_action('automatic_google_transcription', ['en', 'es'])

        self._add_manual_nlp_action('transcription', 'en', 'Hello')
        self._add_automatic_nlp_action('transcription', 'en', 'Hello automatic', True)
        self._add_automatic_nlp_action('transcription', 'es', 'Hola', True)
        self._add_manual_nlp_action('transcription', 'fr', 'Bonjour')

        output = SubmissionSupplement.retrieve_data(
            self.asset, self.submission_root_uuid, for_output=True
        )
        transcription_data = output[self.xpath].get('transcript')
        assert transcription_data == {
            'value': 'Bonjour',
            'languageCode': 'fr',
            'regionCode': None,
        }

    def test_retrieve_data_for_output_selects_most_recent_translation_by_language(self):
        # Enable automatic translations in Spanish and German
        self._enable_nlp_action('automatic_google_translation', ['es', 'de'])
        # translations require a transcription
        self._add_manual_nlp_action('transcription', 'en', 'Hi')

        self._add_manual_nlp_action('translation', 'es', 'Hola')
        self._add_manual_nlp_action('translation', 'fr', 'Bonjour')
        self._add_automatic_nlp_action('translation', 'es', 'Hola automatico', True)
        self._add_automatic_nlp_action('translation', 'de', 'Guten tag', True)

        output = SubmissionSupplement.retrieve_data(
            self.asset, self.submission_root_uuid, for_output=True
        )
        translations = output[self.xpath]['translation']
        # most recent Spanish translation
        assert translations['es']['value'] == 'Hola automatico'
        assert translations['fr']['value'] == 'Bonjour'
        assert translations['de']['value'] == 'Guten tag'

    # skip until we actually fill out or delete this test
    @pytest.mark.skip()
    def test_retrieve_data_with_stale_questions(self):
        SubmissionSupplement.objects.create(
            asset=self.asset,
            submission_uuid=self.submission_root_uuid,
            content=self.EXPECTED_SUBMISSION_SUPPLEMENT,
        )
        advanced_features = deepcopy(self.ADVANCED_FEATURES)
        config = advanced_features['_actionConfigs'].pop(self.xpath)
        advanced_features['_actionConfigs']['group_name/renamed_question_name'] = config
        submission_supplement = SubmissionSupplement.retrieve_data(
            self.asset, self.submission_root_uuid
        )
        assert submission_supplement == EMPTY_SUPPLEMENT

    # skip until we update how we migrate advanced_actions
    @pytest.mark.skip()
    def test_retrieve_data_from_migrated_data(self):
        submission_supplement = {
            self.xpath: {
                'transcript': {
                    'languageCode': 'ar',
                    'value': 'فارغ',
                    'dateCreated': '2024-04-08T15:27:00Z',
                    'dateModified': '2024-04-08T15:31:00Z',
                    'revisions': [
                        {
                            'languageCode': 'ar',
                            'value': 'هائج',
                            'dateModified': '2024-04-08T15:27:00Z',
                        }
                    ],
                },
                'translation': [
                    {
                        'languageCode': 'en',
                        'value': 'berserk',
                        'dateCreated': '2024-04-08T15:27:00Z',
                        'dateModified': '2024-04-08T15:27:00Z',
                    },
                    {
                        'languageCode': 'es',
                        'value': 'enloquecido',
                        'dateCreated': '2024-04-08T15:29:00Z',
                        'dateModified': '2024-04-08T15:32:00Z',
                        'revisions': [
                            {
                                'languageCode': 'es',
                                'value': 'loco',
                                'dateModified': '2024-04-08T15:29:00Z',
                            }
                        ],
                    },
                ],
            },
        }

        SubmissionSupplement.objects.create(
            asset=self.asset,
            submission_uuid=self.submission_root_uuid,
            content=submission_supplement,
        )
        submission_supplement = SubmissionSupplement.retrieve_data(
            self.asset, submission_root_uuid=self.submission_root_uuid
        )
        assert submission_supplement == self.EXPECTED_SUBMISSION_SUPPLEMENT

    def test_retrieve_data_with_submission_root_uuid(self):
        self.test_revise_data()
        submission_supplement = SubmissionSupplement.retrieve_data(
            self.asset, submission_root_uuid=self.submission_root_uuid
        )
        assert submission_supplement == self.EXPECTED_SUBMISSION_SUPPLEMENT

    def test_revise_data(self):
        assert not SubmissionSupplement.objects.filter(
            submission_uuid=self.submission_root_uuid
        ).exists()

        fake_uuids = [
            uuid.UUID('123e4567-e89b-12d3-a456-426614174000'),
            uuid.UUID('22b04ce8-61c2-4383-836f-5d5f0ad73645'),
            uuid.UUID('30d0f39c-a1dd-43fe-999a-844f12f83d31'),
            uuid.UUID('51ff33a5-62d6-48ec-94b2-2dfb406e1dee'),
            uuid.UUID('d69b9263-04fd-45b4-b011-2e166cfefd4a'),
        ]

        self._enable_nlp_action('manual_transcription', ['ar'])
        self._enable_nlp_action('manual_translation', ['en'])

        with patch('uuid.uuid4', side_effect=fake_uuids):

            frozen_datetime_now = datetime(
                2024, 4, 8, 15, 27, 0, tzinfo=ZoneInfo('UTC')
            )
            with freeze_time(frozen_datetime_now):

                # 1) First call with transcription (ar) and translation (en)
                SubmissionSupplement.revise_data(
                    self.asset,
                    self.submission,
                    {
                        '_version': '20250820',
                        self.xpath: {
                            'manual_transcription': {
                                'language': 'ar',
                                'value': 'هائج',
                            },
                            'manual_translation': {
                                'language': 'en',
                                'value': 'berserk',
                            },
                        },
                    },
                )

            # Make sure a SubmissionSupplement object has been created
            assert SubmissionSupplement.objects.filter(
                submission_uuid=self.submission_root_uuid
            ).exists()

            # 2) Call with translation es = "loco"
            frozen_datetime_now = datetime(
                2024, 4, 8, 15, 29, 0, tzinfo=ZoneInfo('UTC')
            )
            with freeze_time(frozen_datetime_now):
                SubmissionSupplement.revise_data(
                    self.asset,
                    self.submission,
                    {
                        '_version': '20250820',
                        self.xpath: {
                            'manual_translation': {
                                'language': 'es',
                                'value': 'loco',
                            },
                        },
                    },
                )

            assert (
                SubmissionSupplement.objects.filter(
                    submission_uuid=self.submission_root_uuid
                ).count()
                == 1
            )

            # 3) Call with transcription ar = 'مجنون'
            frozen_datetime_now = datetime(
                2024, 4, 8, 15, 31, 0, tzinfo=ZoneInfo('UTC')
            )
            with freeze_time(frozen_datetime_now):
                submission_supplement = SubmissionSupplement.revise_data(
                    self.asset,
                    self.submission,
                    {
                        '_version': '20250820',
                        self.xpath: {
                            'manual_transcription': {
                                'language': 'ar',
                                'value': 'مجنون',
                            },
                        },
                    },
                )

            # 4) Call with translation es = "enloquecido"
            frozen_datetime_now = datetime(
                2024, 4, 8, 15, 32, 0, tzinfo=ZoneInfo('UTC')
            )
            with freeze_time(frozen_datetime_now):
                submission_supplement = SubmissionSupplement.revise_data(
                    self.asset,
                    self.submission,
                    {
                        '_version': '20250820',
                        self.xpath: {
                            'manual_translation': {
                                'language': 'es',
                                'value': 'enloquecido',
                            },
                        },
                    },
                )

            assert submission_supplement == self.EXPECTED_SUBMISSION_SUPPLEMENT

    def test_revise_data_raise_error_wrong_action(self):

        with pytest.raises(InvalidAction):
            SubmissionSupplement.revise_data(
                self.asset,
                self.submission,
                {
                    '_version': '20250820',
                    self.xpath: {'my_other_action': {'param': 'foo'}},
                },
            )

    def test_revise_data_raise_error_wrong_question_name(self):

        with pytest.raises(InvalidXPath):
            SubmissionSupplement.revise_data(
                self.asset,
                self.submission,
                {
                    '_version': '20250820',
                    'group_name/other_question_name': {
                        'manual_translation': {
                            'language': 'en',
                            'value': 'crazy',
                        }
                    },
                },
            )
