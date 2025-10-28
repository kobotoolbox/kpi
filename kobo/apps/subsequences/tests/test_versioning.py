from datetime import timedelta
from unittest.mock import patch

import pytest
from ddt import data, ddt
from django.test import TestCase
from django.utils import timezone
from freezegun import freeze_time

from kobo.apps.subsequences.utils.versioning import (
    determine_source_transcripts,
    migrate_submission_supplementals,
    new_revision_from_old,
    separate_transcriptions,
)


@ddt
class TestVersioning(TestCase):
    def test_new_transcript_revision_from_old(self):
        now = timezone.now()
        old = {
            'dateCreated': None,
            'dateModified': '2025-10-22 17:09:38',
            'languageCode': 'en',
            'value': 'Transcribed new',
        }
        with freeze_time(now):
            result = new_revision_from_old(old)
        assert result['value'] == old['value']
        assert result['language'] == old['languageCode']
        assert result['_dateCreated'] == old['dateModified']
        assert result['_uuid'] is not None
        assert result['_dateAccepted'] is None

    def test_new_transcript_revision_from_old_returns_none_for_bad_data(self):
        old = {'badly': 'formatted'}
        assert new_revision_from_old(old) is None

    @data(True, False)
    def test_separate_automated_and_manual_transcriptions(self, latest_is_automated):
        now = timezone.now()
        yesterday = timezone.now() - timedelta(days=1)
        transcript_dict = {
            'dateCreated': None,
            'dateModified': now,
            'languageCode': 'en',
            'revisions': [
                {
                    'dateModified': yesterday,
                    'languageCode': 'en',
                    'value': 'Old transcript',
                }
            ],
            'value': 'Latest transcript',
        }
        automated_transcription_value = (
            'Latest transcript' if latest_is_automated else 'Old transcript'
        )
        manual, automated = separate_transcriptions(
            transcript_dict, 'en', automated_transcription_value
        )
        new_automated_transcript = automated[0]
        new_manual_transcript = manual[0]
        expected_most_recent_transcript = (
            new_automated_transcript if latest_is_automated else new_manual_transcript
        )
        expected_old_transcript = (
            new_manual_transcript if latest_is_automated else new_automated_transcript
        )

        assert expected_most_recent_transcript['_dateCreated'] == now
        assert expected_most_recent_transcript['value'] == 'Latest transcript'
        assert expected_old_transcript['_dateCreated'] == yesterday
        assert expected_old_transcript['value'] == 'Old transcript'

    def test_migrate_transcriptions(self):
        now = timezone.now()
        one_year_ago = now - timedelta(days=365)
        old_version = {'Audio_question': {'googlets': {'languageCode': 'en',
                                 'regionCode': None,
                                 'status': 'complete',
                                 'value': 'This is audio that I am trying to '
                                          'transcribe.'},
                    'transcript': {'dateCreated': one_year_ago,
                                   'dateModified': now,
                                   'languageCode': 'en',
                                   'revisions': [{'dateModified': one_year_ago,
                                                  'languageCode': 'en',
                                                  'value': 'This is audio that '
                                                           'I am trying to '
                                                           'transcribe.'},
                                                 {}],
                                   'value': 'This is audio that I am trying to '
                                            'transcribe but i edited it.'},
                                          }
                       }
        with patch('kobo.apps.subsequences.utils.versioning.generate_uuid_for_form', side_effect=['uuid1', 'uuid2']):
            with freeze_time(now):
                migrated = migrate_submission_supplementals(old_version)
        expected = {
            '_version': '20250820',
            'Audio_question': {
                                  'automatic_transcription': {
                                      '_dateCreated': one_year_ago,
                                      '_dateModified': one_year_ago,
                                      '_versions': [
                                          {
                                              '_dateCreated': one_year_ago,
                                              '_dateAccepted': now,
                                              '_uuid':'uuid2',
                                              'language': 'en',
                                              'value': 'This is audio that I am trying to '
                                                       'transcribe.',
                                              'status': 'complete',
                                          }
                                      ]
                                  },
                                  'manual_transcription': {
                                      '_dateCreated': now,
                                      '_dateModified': now,
                                      '_versions': [
                                          {
                                              '_dateCreated': now,
                                              '_dateAccepted': None,
                                              '_uuid':'uuid1',
                                              'language': 'en',
                                              'value': 'This is audio that I am trying to '
                                                       'transcribe but i edited it.',
                                          }
                                      ]
                                  },
            }
        }
        assert migrated == expected

    def test_determine_source_transcripts(self):
        manual_transcripts = []
        automatic_transcripts = []
        now = timezone.now()
        for i in range(5):
            manual = {
                '_dateCreated': now - timedelta(days=i),
                'language': 'en',
                'value': 'Value',
                '_uuid': f'uuid-{i}-manual',
                '_dateAccepted': None,
            }
            automatic = {
                **manual,
                '_uuid': f'uuid-{i}-automatic',
                '_dateCreated': now - timedelta(days=i + 1),
            }
            manual_transcripts.append(manual)
            automatic_transcripts.append(automatic)
        # add an old transcript in a different language
        manual_transcripts.append(
            {
                '_dateCreated': now - timedelta(days=5),
                'language': 'fr',
                'value': 'Value',
                '_uuid': f'uuid-5-manual',
                '_dateAccepted': None,
            }
        )
        most_recent_overall, most_recent_by_language = determine_source_transcripts(
            manual_transcripts, automatic_transcripts
        )
        assert most_recent_overall['_uuid'] == 'uuid-0-manual'
        assert most_recent_overall['_actionId'] == 'manual_transcription'
        assert most_recent_by_language['en']['_uuid'] == 'uuid-0-manual'
        assert most_recent_by_language['en']['_actionId'] == 'manual_transcription'
        assert most_recent_by_language['fr']['_uuid'] == 'uuid-5-manual'
        assert most_recent_by_language['fr']['_actionId'] == 'manual_transcription'

    def test_migrate_translations(self):
        pass


    def test_migrate_submission_extra_to_supplemental(self):
        now = timezone.now()
        one_year_ago = (now - timedelta(days=365)).isoformat()
        old_version = {'Audio_question': {'googlets': {'languageCode': 'en',
                                 'regionCode': None,
                                 'status': 'complete',
                                 'value': 'This is audio that I am trying to '
                                          'transcribe.'},
                    'googletx': {'languageCode': 'es',
                                 'source': 'en',
                                 'status': 'complete',
                                 'value': 'Esto es un audio que estoy '
                                          'intentando a transcribir.'},
                    'transcript': {'dateCreated': one_year_ago,
                                   'dateModified': now.isoformat(),
                                   'languageCode': 'en',
                                   'revisions': [{'dateModified': one_year_ago,
                                                  'languageCode': 'en',
                                                  'value': 'This is audio that '
                                                           'I am trying to '
                                                           'transcribe.'},
                                                 {}],
                                   'value': 'This is audio that I am trying to '
                                            'transcribe but i edited it.'},
                    'translation': {'es': {'dateCreated': one_year_ago,
                                           'dateModified': now.isoformat(),
                                           'languageCode': 'es',
                                           'revisions': [{'dateModified': one_year_ago,
                                                          'languageCode': 'es',
                                                          'value': 'Esto es un '
                                                                   'audio que '
                                                                   'estoy '
                                                                   'intentando a '
                                                                   'transcribir.'}],
                                           'value': 'Esto es un audio que '
                                                    'estoy intentando '
                                                    'transcribir pero yo lo edité'}}}}

        with patch('kobo.apps.subsequences.utils.versioning.generate_uuid_for_form', side_effect=['uuid1', 'uuid2', 'uuid3', 'uuid4']):
            with freeze_time(now):
                migrated = migrate_submission_supplementals(old_version)

        new_version = {
            '_version': '20250820',
            'Audio_question': {
                'automatic_transcription': {
                    '_dateCreated': one_year_ago,
                    '_dateModified': one_year_ago,
                    '_versions': [
                        {
                            '_dateCreated': one_year_ago,
                            '_dateAccepted': now.isoformat(),
                            '_uuid':'uuid2',
                            'language': 'en',
                            'value': 'This is audio that I am trying to '
                                          'transcribe.',
                            'status': 'complete',
                        }
                    ]
                },
                'automatic_translation': {
                    'es': {
                        '_dateCreated': one_year_ago,
                        '_dateModified': one_year_ago,
                        '_versions': [
                            {
                                '_dateCreated': one_year_ago,
                                '_dateAccepted': now.isoformat(),
                                '_dependency': {'_actionId': 'manual_transcription',
                                                '_uuid': 'uuid1'},
                                '_uuid':'uuid4',
                                'language': 'es',
                                'value': 'Esto es un audio que estoy intentando a transcribir.',
                                'status': 'complete'
                            }
                        ]
                    }
                },
                'manual_transcription': {
                    '_dateCreated': now.isoformat(),
                    '_dateModified': now.isoformat(),
                    '_versions': [
                        {
                            '_dateCreated': now.isoformat(),
                            '_dateAccepted': None,
                            '_uuid':'uuid1',
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
                                '_uuid':'uuid3',
                                'language': 'es',
                                'value': 'Esto es un audio que estoy intentando transcribir pero yo lo edité',
                            }
                        ]
                    }
                },
            }
        }
        assert migrated == new_version  # add assertion here

