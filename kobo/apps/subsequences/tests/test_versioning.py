from datetime import timedelta

import pytest
from mock import patch
from ddt import data, ddt
from django.test import TestCase
from django.utils import timezone
from freezegun import freeze_time

from kobo.apps.subsequences.utils.versioning import (
    new_transcript_revision_from_old,
    separate_transcriptions, migrate_advanced_features, migrate_submission_supplementals,
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
            result = new_transcript_revision_from_old(old)
        assert result['value'] == old['value']
        assert result['language'] == old['languageCode']
        assert result['_dateCreated'] == old['dateModified']
        assert result['_uuid'] is not None
        assert result['_dateAccepted'] is None

    def test_new_transcript_revision_from_old_returns_none_for_bad_data(self):
        old = {'badly': 'formatted'}
        assert new_transcript_revision_from_old(old) is None

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

    @pytest.mark.skip()
    def test_migrate_submission_extra_to_supplemental(self):
        old_version = {'Audio_question': {'googlets': {'languageCode': 'en',
                                 'regionCode': None,
                                 'status': 'complete',
                                 'value': 'This is audio that I am trying to '
                                          'transcribe.'},
                    'googletx': {'languageCode': 'es',
                                 'source': 'en',
                                 'status': 'complete',
                                 'value': 'Este es un audio que estoy '
                                          'intentando transcribir.'},
                    'transcript': {'dateCreated': None,
                                   'dateModified': '2025-10-22 17:09:38',
                                   'languageCode': 'en',
                                   'revisions': [{'dateModified': '2025-10-22 '
                                                                  '14:30:24',
                                                  'languageCode': 'en',
                                                  'value': 'This is audio that '
                                                           'I am trying to '
                                                           'transcribe.'},
                                                 {}],
                                   'value': 'This is audio that I am trying to '
                                            'transcribe but i edited it.'},
                    'translation': {'es': {'dateCreated': '2025-10-22T14:30:38Z',
                                           'dateModified': '2025-10-22T17:10:23Z',
                                           'languageCode': 'es',
                                           'revisions': [{'dateModified': '2025-10-22T14:30:38Z',
                                                          'languageCode': 'es',
                                                          'value': 'Este es un '
                                                                   'audio que '
                                                                   'estoy '
                                                                   'intentando '
                                                                   'transcribir.'}],
                                           'value': 'Este es un audio que '
                                                    'estoy intentando '
                                                    'transcribir pero yo lo edité'}}}}

        new_version = {
            '_version': '20250820',
            'Audio_question': {
                'automatic_transcription': {
                    '_dateCreated': '',
                    '_dateModified': '',
                    '_versions': [
                        {
                            '_dateCreated': '',
                            '_dateAccepted': '',
                            '_uuid':'',
                            'language': 'en',
                            'value': 'This is audio that I am trying to '
                                          'transcribe.',
                            'status': 'complete',
                        }
                    ]
                },
                'automatic_translation': {
                    'es': {
                        '_dateCreated': '',
                        '_dateModified': '',
                        '_versions': [
                            {
                                '_dateCreated': '',
                                '_dateAccepted': '',
                                '_dependency': {'_actionId': 'manual_transcription',
                                                '_uuid': 'a0030a86-d207-4249-8335-9a767fbd77eb'},
                                '_uuid':'',
                                'language': 'es',
                                'value': 'Esto es un audio que estoy intendando a transcribir',
                                'status': 'complete'
                            }
                        ]
                    }
                },
                'manual_transcription': {
                    '_dateCreated': '',
                    '_dateModified': '',
                    '_versions': [
                        {
                            '_dateCreated': '',
                            '_dateAccepted': '',
                            '_uuid':'',
                            'language': 'en',
                            'value': 'This is audio that I am trying to '
                                     'transcribe but i edited it.',
                        }
                    ]
                },
                'manual_translation': {
                    'es': {
                        '_dateCreated': '',
                        '_dateModified': '',
                        '_versions': [
                            {
                                '_dateCreated': '',
                                '_dateAccepted': '',
                                '_dependency': {'_actionId': 'automatic_transcription',
                                                '_uuid': 'a0030a86-d207-4249-8335-9a767fbd77eb'},
                                '_uuid':'',
                                'language': 'es',
                                'value': 'Esto es un audio que estoy intendando a transcribir pero yo lo edité',
                                'status': 'complete'
                            }
                        ]
                    }
                },
            }
        }


        self.assertEqual(True, False)  # add assertion here

