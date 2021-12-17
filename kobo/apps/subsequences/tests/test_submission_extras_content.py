from kpi.models import Asset
from jsonschema import validate
from jsonschema import Draft7Validator

def sample_asset():
    asset = Asset()
    asset.content = {
        'survey': [
            {'type': 'audio',
             'name': 'q1'}
        ]
    }
    return asset

def test_asset_makes_schema_for_transcript():
    asset = sample_asset()
    asset.advanced_features = {'transcript': {}}
    schema = asset.get_advanced_submission_schema()
    Draft7Validator.check_schema(schema)

def test_content_patches_in_for_transcript():
    asset = sample_asset()
    asset.advanced_features = {'transcript': {}}
    schema = asset.get_advanced_submission_schema()

    posted_data = {'submission': 'submissionuuid',
        'q1': {
            'transcript_manual': {
                'value': 'a b c',
            }
        }
    }
    schema = asset.get_advanced_submission_schema()
    validate(posted_data, schema)

# def test_asset_makes_schema_for_translation():
#     asset = sample_asset()
#     asset.advanced_features = {'translation': {}}
#     schema = asset.get_advanced_submission_schema()
#     # fails
#     Draft7Validator.check_schema(schema)
