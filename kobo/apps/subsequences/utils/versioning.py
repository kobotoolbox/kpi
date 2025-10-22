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
        print(f'{key=}, {value=}')
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
            survey_qs = value['qual_survey']
            raise NotImplementedError

    return migrated_advanced_features


def set_version(schema: dict) -> dict:
    schema['_version'] = SCHEMA_VERSIONS[0]
    return schema

def migrate_submission_supplementals(supplemental_data:dict) -> dict:
    if supplemental_data.get('_version', None) == SCHEMA_VERSIONS[0]:
        return
    supplemental = {
        '_version': SCHEMA_VERSIONS[0],
    }
    for question_xpath, action_results in supplemental_data:
        question_results_by_action = {}
        for action, results in action_results:
            if action == 'googlets':
                pass
            if action == 'googletx':
                pass
            if action == 'qual':
                pass
            if action == 'transcript':
                pass
            if action == 'translation':
                pass

def get_automated_transcriptions_by_language(action_results:dict) -> dict:
    pass
