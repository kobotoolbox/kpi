from copy import deepcopy
import jsonschema

from .actions import ACTION_IDS_TO_CLASSES, ACTIONS
from .constants import SCHEMA_VERSIONS
from .utils.versioning import migrate_advanced_features

# not the full complexity of XPath, but a slash-delimited path of valid XML tag
# names to convey group hierarchy
QUESTION_XPATH_PATTERN = '^([A-Za-z_][A-Za-z0-9_-]*)(/[A-Za-z_][A-Za-z0-9_-]*)*$'

_action_params_schemas = {}
_action_params_defs = {}
for a in ACTIONS:
    _action_params_schemas[a.ID] = deepcopy(a.params_schema)
    _action_params_defs.update(_action_params_schemas[a.ID].pop('$defs', {}))

ACTION_PARAMS_SCHEMA = {
    '$defs': _action_params_defs,
    'additionalProperties': False,
    'properties': {
        '_actionConfigs': {
            'additionalProperties': False,
            'patternProperties': {
                QUESTION_XPATH_PATTERN: {
                    'additionalProperties': False,
                    'properties': _action_params_schemas,
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

    if migrated_schema := migrate_advanced_features(asset.advanced_features):
        asset.advanced_features = migrated_schema

    submission_supplement_schema = {
        'additionalProperties': False,
        'properties': {'_version': {'const': SCHEMA_VERSIONS[0]}},
        'type': 'object',
    }

    for (
        question_xpath,
        action_configs_for_this_question,
    ) in asset.advanced_features['_actionConfigs'].items():
        for (
            action_id,
            action_params,
        ) in action_configs_for_this_question.items():
            action = ACTION_IDS_TO_CLASSES[action_id](question_xpath, action_params)
            submission_supplement_schema['properties'].setdefault(question_xpath, {})[
                action_id
            ] = action.result_schema

    return submission_supplement_schema
