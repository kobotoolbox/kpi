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
                    'qual': [{'type': 'qual_text',
                              'uuid': 'b8188424-6249-4168-8137-7d9fab62ae3c',
                              'val': 'Trying to transcribe audio'}],
                    'transcript': {'dateCreated': '2025-10-22 14:30:24',
                                   'dateModified': '2025-10-22 14:30:24',
                                   'languageCode': 'en',
                                   'revisions': [{}],
                                   'value': 'This is audio that I am trying to '
                                            'transcribe.'},
                    'translation': {'es': {'dateCreated': '2025-10-22T14:30:38Z',
                                           'dateModified': '2025-10-22T14:30:38Z',
                                           'languageCode': 'es',
                                           'revisions': [],
                                           'value': 'Este es un audio que '
                                                    'estoy intentando '
                                                    'transcribir.'}}}}

        self.assertEqual(True, False)  # add assertion here

