from kpi.constants import (
    PROJECT_HISTORY_LOG_PERMISSION_SUBTYPE,
    PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
)

PROJECT_HISTORY_LOG_METADATA_SCHEMA = {
    'type': 'object',
    'additionalProperties': True,
    'properties': {
        'ip_address': {'type': 'string'},
        'source': {'type': 'string'},
        'asset_uid': {'type': 'string'},
        'log_subtype': {
            'type': 'string',
            'enum': [
                PROJECT_HISTORY_LOG_PROJECT_SUBTYPE,
                PROJECT_HISTORY_LOG_PERMISSION_SUBTYPE,
            ],
        },
    },
    'required': ['ip_address', 'source', 'asset_uid', 'log_subtype'],
}
