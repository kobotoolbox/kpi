"""
When setting "asset.advanced_features", the value is compared
against this jsonschema.

As "advanced_features" are added to the code, this schema will grow
to describe what is needed.
"""

ADVANCED_FEATURES_PARAMS_SCHEMA = {
    'type': 'object',
    'additionalProperties': False,
    'properties': {
        'transcript': {
            'type': 'object',
            'properties': {
                'values': {
                    'type': 'array',
                    'items': {'type': 'string'},
                },
                'services': {
                    'type': 'array',
                    'items': {'type': 'string'},
                },
                'languages': {
                    'type': 'array',
                    'items': {'type': 'string'},
                },
            },
        },
        'translation': {
            'type': 'object',
            'properties': {
                'languages': {'type': 'array', 'items': {'type': 'string'}},
                'values': {
                    'type': 'array',
                    'items': {'type': 'string'},
                },
            },
            'required': ['languages'],
        },
    },
}

# User-defined qualitative analysis forms
ADVANCED_FEATURES_PARAMS_SCHEMA['$defs'] = {
    'qualQuestionType': {
        'type': 'string',
        'enum': [
            'qual_tags',
            'qual_text',
            'qual_integer',
            'qual_select_one',
            'qual_select_multiple',
            'qual_note',
            'qual_auto_keyword_count',
        ],
    },
    'qualQuestion': {
        'type': 'object',
        'additionalProperties': False,
        'properties': {
            'uuid': {'$ref': '#/$defs/qualUuid'},
            'type': {'$ref': '#/$defs/qualQuestionType'},
            'labels': {'$ref': '#/$defs/qualLabels'},
            'choices': {
                'type': 'array',
                'items': {'$ref': '#/$defs/qualChoice'},
            },
            'scope': {'type': 'string'},
            'xpath': {'type': 'string'},
            'options': {'type': 'object'},
        },
        'required': ['uuid', 'type', 'labels', 'scope', 'xpath'],
    },
    'qualLabels': {
        'type': 'object',
        'additionalProperties': False,
        'patternProperties': {'.+': {'type': 'string'}},
    },
    'qualUuid': {'type': 'string', 'minLength': 1},
    'qualChoice': {
        'type': 'object',
        'additionalProperties': False,
        'properties': {
            'labels': {'$ref': '#/$defs/qualLabels'},
            'uuid': {'$ref': '#/$defs/qualUuid'},
            'options': {'type': 'object'},
        },
        'required': ['labels', 'uuid'],
    },
}

ADVANCED_FEATURES_PARAMS_SCHEMA['properties']['qual'] = {
    'type': 'object',
    'additionalProperties': False,
    'properties': {
        'qual_survey': {
            'type': 'array',
            'items': {'$ref': '#/$defs/qualQuestion'},
        }
    }
}
