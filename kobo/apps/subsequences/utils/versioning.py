from ..constants import SCHEMA_VERSIONS

def set_version(schema: dict) -> dict:
    schema['_version'] = SCHEMA_VERSIONS[0]
    return schema
