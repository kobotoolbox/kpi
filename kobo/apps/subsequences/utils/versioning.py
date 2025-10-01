from ..constants import SCHEMA_VERSIONS


def migrate_advanced_features(advanced_features: dict) -> dict | None:

    if advanced_features.get('_version') == SCHEMA_VERSIONS[0]:
        return

    migrated_advanced_features = {
        '_version': SCHEMA_VERSIONS[0],
        '_actionConfigs': {}
    }

    actionConfigs = migrated_advanced_features['_actionConfigs']
    for key, value in advanced_features.items():
        if (
            key == 'transcript'
            and value
            and 'languages' in value
            and value['languages']
        ):
            actionConfigs['manual_transcription'] = [
                {'language': language} for language in value['languages']
            ]

        if (
            key == 'translation'
            and value
            and 'languages' in value
            and value['languages']
        ):
            actionConfigs['manual_translation'] = [
                {'language': language} for language in value['languages']
            ]

        if key == 'qual':
            raise NotImplementedError

    return migrated_advanced_features


def set_version(schema: dict) -> dict:
    schema['_version'] = SCHEMA_VERSIONS[0]
    return schema
