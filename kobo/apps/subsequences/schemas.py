from copy import deepcopy
import jsonschema

from .actions import ACTION_IDS_TO_CLASSES, ACTIONS
from .constants import SCHEMA_VERSIONS
from .utils.versioning import migrate_advanced_features

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
    jsonschema.validate(supplement, get_submission_supplement_schema(asset))


def get_submission_supplement_schema(asset: 'kpi.models.Asset') -> dict:

    if migrated_schema := migrate_advanced_features(asset.advanced_features):
        asset.advanced_features = migrated_schema

    top_level_defs = {}
    submission_supplement_schema = {
        '$defs': top_level_defs,
        'additionalProperties': False,
        'properties': {'_version': {'const': SCHEMA_VERSIONS[0]}},
        'type': 'object',
    }

    for (
        question_xpath,
        action_configs_for_this_question,
    ) in asset.advanced_features['_actionConfigs'].items():
        per_question_schema = {
            'additionalProperties': False,
            'properties': {},
            'type': 'object',
        }
        submission_supplement_schema['properties'][
            question_xpath
        ] = per_question_schema

        for (
            action_id,
            action_params,
        ) in action_configs_for_this_question.items():
            action = ACTION_IDS_TO_CLASSES[action_id](
                question_xpath, action_params
            )
            action_result_schema = deepcopy(action.result_schema)
            # Un-nest definitions
            top_level_defs.update(action_result_schema.pop('$defs', {}))
            per_question_schema['properties'][action_id] = action_result_schema

    return submission_supplement_schema
