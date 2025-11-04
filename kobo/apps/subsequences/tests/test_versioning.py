from datetime import datetime, timedelta
from unittest.mock import patch

from ddt import data, ddt, unpack
from django.test import TestCase
from django.utils import timezone
from freezegun import freeze_time

from kobo.apps.subsequences.utils.versioning import (
    _determine_source_transcript,
    _new_revision_from_old,
    _separate_manual_and_automatic_versions,
    migrate_submission_supplementals,
)


@ddt
class TestVersioning(TestCase):
    def setUp(self):
        super().setUp()
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
        assert result['value'] == old['value']
        assert result['language'] == old['languageCode']
        assert result['_dateCreated'] == old['dateModified']
        assert result['_uuid'] is not None
        assert result['_dateAccepted'] is None

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
        assert expected_most_recent_transcript['value'] == 'Latest value'
        assert expected_old_transcript['_dateCreated'] == self.yesterday
        assert expected_old_transcript['value'] == 'Old value'

    def test_separate_automatic_and_manual_forces_language_if_given(self):
        manual, automated = _separate_manual_and_automatic_versions(
            self.action_dict, None, None, language='en'
        )
        for formatted_item in manual:
            assert formatted_item['language'] == 'en'

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
                'language': 'en',
                '_actionId': 'manual_transcription',
            },
            {
                '_uuid': 'uuid2',
                '_dateCreated': jan_1_2024.isoformat(),
                'language': 'en',
                '_actionId': 'automatic_transcription',
            },
            {
                '_uuid': 'uuid3',
                '_dateCreated': one_day_ago.isoformat(),
                'language': 'de',
                '_actionId': 'manual_transcription',
            },
            {
                '_uuid': 'uuid4',
                '_dateCreated': jan_2_2024.isoformat(),
                'language': 'de',
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
            }
        }

        with patch(
            'kobo.apps.subsequences.utils.versioning.uuid.uuid4',
            side_effect=['uuid1', 'uuid2', 'uuid3', 'uuid4'],
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
                            'language': 'en',
                            'value': 'This is audio that I am trying to transcribe.',
                            'status': 'complete',
                        }
                    ]
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
                                'language': 'es',
                                'value': 'Esto es un audio que estoy intentando a'
                                ' transcribir.',
                                'status': 'complete',
                            }
                        ]
                    }
                },
                'manual_transcription': {
                    '_dateCreated': one_day_ago,
                    '_dateModified': one_day_ago,
                    '_versions': [
                        {
                            '_dateCreated': one_day_ago,
                            '_dateAccepted': None,
                            '_uuid': 'uuid1',
                            'language': 'en',
                            'value': 'This is audio that I am trying to '
                                     'transcribe but i edited it.',
                        }
                    ]
                },
                'manual_translation': {
                    'es': {
                        '_dateCreated': now.isoformat(),
                        '_dateModified': now.isoformat(),
                        '_versions': [
                            {
                                '_dateCreated': now.isoformat(),
                                '_dateAccepted': None,
                                '_dependency': {'_actionId': 'manual_transcription',
                                                '_uuid': 'uuid1'},
                                '_uuid': 'uuid3',
                                'language': 'es',
                                'value': 'Esto es un audio que estoy intentando'
                                ' transcribir pero yo lo edité',
                            }
                        ]
                    }
                },
            }
        }
        assert migrated == new_version
