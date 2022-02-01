import json

from django.test import TestCase

from kobo.apps.subsequences.utils import stream_with_extras
from kpi.models import Asset

def mock_submission_stream():
    yield {'_uuid': 'aaa'}
    yield {'_uuid': 'bbb'}

class TestSubmissionStream(TestCase):
    def setUp(self):
        self.asset = Asset()

    def test_submission_stream_is_flat(self):
        extras = {
            'aaa': {'QQ': {'transcript': {'value': 'New transcript',
                   'revisions': [{'value': 'Here is the audio transcript',
                     'dateModified': '2021-12-27 22:51:23',
                     'languageCode': 'en'}],
                   'dateCreated': '2022-01-19 23:06:55',
                   'dateModified': '2022-01-19 23:06:55'},
                  'translated': {'en': {'value': 'new translation'},
                   'revisions': [{'en': {'value': 'le translation'},
                     'dateModified': '2022-01-19 23:10:04'}],
                   'dateCreated': '2022-01-19 23:14:15',
                   'dateModified': '2022-01-19 23:14:15'}}
            },
            'bbb': {'QQ': {'transcript': {'value': 'New transcript',
                   'revisions': [],
                   'dateCreated': '2022-01-19 23:16:51',
                   'dateModified': '2022-01-19 23:16:51'},
                  'translated': {'en': {'value': 'new translation'},
                   'revisions': [],
                   'dateCreated': '2022-01-19 23:16:51',
                   'dateModified': '2022-01-19 23:16:51'}}},
        }
        output = []
        for i in stream_with_extras(mock_submission_stream(), extras):
            output.append(i)
        assert '_supplementalDetails' in output[0]
        assert '_supplementalDetails' in output[1]
        # test other things?
