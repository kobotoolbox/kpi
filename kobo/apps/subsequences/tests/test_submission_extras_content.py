import json

from kpi.models import Asset
from kobo.apps.subsequences.models import SubmissionExtras
from jsonschema import validate
from jsonschema.exceptions import ValidationError
from jsonschema import Draft7Validator

TRANSLATED = 'translation'


def sample_asset(advanced_features=None):
    asset = Asset()
    asset.content = {
        'survey': [
            {'type': 'audio',
             'name': 'q1'}
        ]
    }
    if advanced_features != None:
        asset.advanced_features = advanced_features
    return asset

def test_asset_makes_schema_for_transcript():
    asset = sample_asset(advanced_features={'transcript': True})
    schema = asset.get_advanced_submission_schema()
    Draft7Validator.check_schema(schema)

def test_content_patches_in_for_transcript():
    asset = sample_asset(advanced_features={'transcript': True})
    schema = asset.get_advanced_submission_schema()
    posted_data = {'submission': 'submissionuuid',
        'q1': {
            'transcript': {
                'value': 'a b c',
                'languageCode': 'en',
                'dateModified': '2021-12-21',
                'revisions': [
                    {
                        'value': 'x',
                        'languageCode': 'en',
                        'dateModified': '2021-12-20',
                    },
                    {
                        'value': 'y',
                        'languageCode': 'en',
                        'dateModified': '2021-12-19',
                    }
                ]
            }
        }
    }
    schema = asset.get_advanced_submission_schema()
    validate(posted_data, schema)

def assert_invalid_for_schema(content, schema):
    try:
        validate(content, schema)
        raise AssertionError(f'content was not invalid: {content}')
    except ValidationError:
        pass


from pprint import pprint

def get_schema_for_asset(**kwargs):
    asset = sample_asset(**kwargs)
    return asset.get_advanced_submission_schema(content=asset.content)

def test_correct_fields_transcribable():
    asset = sample_asset()
    asset.advanced_features = {'transcript': True}
    action = [*asset.get_advanced_feature_instances()][0]
    assert action.possible_transcribed_fields == ['q1']


def test_transcript_passes_schema():
    schema = get_schema_for_asset(advanced_features={'transcript': True})
    assert 'definitions' in schema
    validate({
        'submission': 'submission-uuid',
        'q1': {
            'transcript': {
                'value': 'x',
            },
        }
    }, schema)

def test_invalid_transcript_fails():
    schema = get_schema_for_asset(advanced_features={'transcript': True})
    assert_invalid_for_schema({
        'submission': 'submission-uuid',
        'q1': {
            # additional property
            'transcript': {'some extra property': 'x'},
        }
    }, schema)
    assert_invalid_for_schema({
        'submission': 'submission-uuid',
        'q1': {
            # note: missing "value"
            'transcript': {},
        }
    }, schema)


def test_correct_fields_translatable():
    asset = sample_asset()
    asset.advanced_features = {TRANSLATED: {'languages': ['en'],
        'values': ['q1']}}
    action = [*asset.get_advanced_feature_instances()][0]
    assert action.translatable_fields == ['q1']


def test_translation_passes_schema():
    asset = sample_asset(advanced_features={
        'transcript': {'values': ['q1']},
        TRANSLATED: {
            'languages': ['t1', 't2'],
            'values': ['q1'],
        }
    })
    inx = [ii for ii in asset.get_advanced_feature_instances()]
    schema = asset.get_advanced_submission_schema()
    validate({
        'submission': 'submission-uuid',
        'q1': {
            'transcript': {
                'value': 'asdf',
            },
            TRANSLATED: {
                't1': {'value': 'b'},
            }
        }
    }, schema)
