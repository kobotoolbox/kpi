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
        },
        # translations example:
        'translation': {
            'type': 'object',
        }
    }
}
