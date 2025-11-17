import jsonschema

from .actions import ACTION_IDS_TO_CLASSES, ACTIONS
from .constants import SCHEMA_VERSIONS
from .models import migrate_advanced_features
from .utils.action_conversion import question_advanced_action_to_action

# not the full complexity of XPath, but a slash-delimited path of valid XML tag
# names to convey group hierarchy
QUESTION_XPATH_PATTERN = '^([A-Za-z_][A-Za-z0-9_-]*)(/[A-Za-z_][A-Za-z0-9_-]*)*$'

ACTION_PARAMS_SCHEMA = {
    'additionalProperties': False,
    'properties': {
        '_actionConfigs': {
            'additionalProperties': False,
            'patternProperties': {
                QUESTION_XPATH_PATTERN: {
                    'additionalProperties': False,
                    'properties': {a.ID: a.params_schema for a in ACTIONS},
                    'type': 'object',
                }
            },
            'type': 'object',
        },
        '_version': {'const': '20250820'},
    },
    'type': 'object',
}


def validate_submission_supplement(asset: 'kpi.models.Asset', supplement: dict):
    jsonschema.validate(get_submission_supplement_schema(asset), supplement)


def get_submission_supplement_schema(asset: 'kpi.models.Asset') -> dict:
    if asset.advanced_features != {}:
        migrate_advanced_features(asset)

    submission_supplement_schema = {
        'additionalProperties': False,
        'properties': {'_version': {'const': SCHEMA_VERSIONS[0]}},
        'type': 'object',
    }
    for question_advanced_action in asset.advanced_features_set.all():
        action = question_advanced_action_to_action(question_advanced_action)
        submission_supplement_schema['properties'].setdefault(question_advanced_action.question_xpath, {})[
            question_advanced_action.action
        ] = action.result_schema

    return submission_supplement_schema
