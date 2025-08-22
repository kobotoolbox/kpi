from .manual_transcription import ManualTranscriptionAction

# TODO, what about using a loader for every class in "actions" folder (except base.py)?
ACTIONS = (ManualTranscriptionAction,)
ACTION_IDS_TO_CLASSES = {a.ID: a for a in ACTIONS}

ADVANCED_FEATURES_PARAMS_SCHEMA = {  # rename?
    'properties': {
        '_schema': {
            'additionalProperties': False,
            'patternProperties': {
                # not the full complexity of XPath, but a slash-delimited path
                # of valid XML tag names to convey group hierarchy
                '^([A-Za-z_][A-Za-z0-9_-]*)(/[A-Za-z_][A-Za-z0-9_-]*)*$': {
                    'additionalProperties': False,
                    'properties': {a.ID: a.params_schema for a in ACTIONS},
                    'type': 'object',
                }
            },
            'type': 'object',
        },
        '_version': {'const': '20250820'},
    }
}
