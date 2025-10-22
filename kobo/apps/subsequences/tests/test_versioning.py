from django.test import TestCase

class TestVersioning(TestCase):
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

