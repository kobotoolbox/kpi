from copy import deepcopy

import jsonschema

from .actions import ACTIONS
from .constants import SCHEMA_VERSIONS

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
    jsonschema.validate(supplement, get_submission_supplement_schema(asset))


def get_submission_supplement_schema(asset: 'kpi.models.Asset') -> dict:

    submission_supplement_schema = {
        'additionalProperties': False,
        'properties': {'_version': {'const': SCHEMA_VERSIONS[0]}},
        'type': 'object',
    }

    for action_config in asset.advanced_features_set.all():
        action = action_config.to_action()
        action.get_action_dependencies({}, asset.advanced_features_set.all())
        submission_supplement_schema['properties'].setdefault(
            action_config.question_xpath, {}
        )[action_config.action] = action.result_schema

    return submission_supplement_schema
