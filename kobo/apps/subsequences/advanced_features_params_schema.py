'''
When setting "asset.advanced_features", the value is compared
against this jsonschema.

As "advanced_features" are added to the code, this schema will grow
to describe what is needed.
'''

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
            }
        },
        'translated': {
            'type': 'object',
            'properties': {
                'languages': {
                    'type': 'array',
                    'items': {'type': 'string'}
                },
                'values': {
                    'type': 'array',
                    'items': {'type': 'string'},
                },
            },
            'required': ['languages']
        }
    }
}
