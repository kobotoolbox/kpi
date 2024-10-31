PROJECT_HISTORY_LOG_METADATA_SCHEMA = {
    'type': 'object',
    'additionalProperties': True,
    'properties': {
        'ip_address': {'type': 'string'},
        'source': {'type': 'string'},
        'asset_uid': {'type': 'string'},
    },
    'required': ['ip_address', 'source', 'asset_uid'],
}
