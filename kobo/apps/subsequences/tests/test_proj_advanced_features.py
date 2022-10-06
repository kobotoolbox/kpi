from kpi.models import Asset
from jsonschema import validate
from jsonschema.exceptions import ValidationError
from jsonschema import Draft7Validator

TRANSLATED = 'translated'


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


def test_schema_has_definitions():
    asset = sample_asset(advanced_features={
        'translated': {
            'values': ['q1'],
            'languages': ['tx1', 'tx2'],
        },
        'transcript': {
            'values': ['q1'],
        }
    })
    schema = asset.get_advanced_submission_schema(content=asset.content)
    assert 'definitions' in schema
    assert 'transcript' in schema['definitions']
    assert 'translation' in schema['definitions']

def test_schema_does_not_have_extra_definitions():
    asset = sample_asset(advanced_features={
        'transcript': {
            'values': ['q1'],
        }
    })
    schema = asset.get_advanced_submission_schema(content=asset.content)
    assert 'definitions' in schema
    assert 'transcript' in schema['definitions']
    assert 'translation' not in schema['definitions']

    asset = sample_asset(advanced_features={
        'translated': {
            'languages': ['t1'],
        }
    })
    schema = asset.get_advanced_submission_schema(content=asset.content)
    assert 'definitions' in schema
    assert 'transcript' not in schema['definitions']
    assert 'translation' in schema['definitions']

def test_details_for_transcript_export():
    asset = sample_asset(advanced_features={
        'transcript': {
            'values': ['q1'],
        },
    })
    asset.known_cols = ['q1:transcript:en']
    _afj = asset.analysis_form_json()
    engines = _afj['engines']
    addl_fields = _afj['additional_fields']
    assert len(addl_fields) == 1
    assert len(engines) == 1

def test_details_for_translation_export():
    asset = sample_asset(advanced_features={
        'translated': {
            'values': ['q1'],
            'languages': ['en', 'fr']
        },
    })
    asset.known_cols = ['q1:translated:en', 'q1:translated:fr']
    _afj = asset.analysis_form_json()
    engines = _afj['engines']
    addl_fields = _afj['additional_fields']
    assert len(addl_fields) == 2
    assert len(engines) == 1
