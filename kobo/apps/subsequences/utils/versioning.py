from django.utils import timezone

from ...openrosa.libs.utils.model_tools import generate_uuid_for_form
from ..constants import SCHEMA_VERSIONS


class InvalidSupplementalFormat(Exception):
    pass

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

def migrate_submission_supplementals(supplemental_data:dict) -> dict:
    if supplemental_data.get('_version', None) == SCHEMA_VERSIONS[0]:
        return
    supplemental = {
        '_version': SCHEMA_VERSIONS[0],
    }
    for question_xpath, action_results in supplemental_data.items():
        question_results_by_action = {}
        automatic_transcript_language, automatic_transcript_result = (
            get_automatic_transcription(action_results)
        )
        manual_transcripts, automatic_transcripts = separate_transcriptions(
            action_results.get('transcript', None),
            automatic_transcript_language,
            automatic_transcript_result,
        )
        # should already be sorted by date created descending, but just in case
        manual_transcripts.sort(reverse=True, key=lambda d: d['_dateCreated'])
        automatic_transcripts.sort(reverse=True, key=lambda d: d['_dateCreated'])

        if len(manual_transcripts) > 0:
            question_results_by_action['manual_transcription'] = {
                '_dateCreated': manual_transcripts[-1]['_dateCreated'],
                '_dateModified': manual_transcripts[0]['_dateCreated'],
                '_versions': manual_transcripts,
            }
        if len(automatic_transcripts) > 0:
            question_results_by_action['automatic_transcription'] = {
                '_dateCreated': automatic_transcripts[-1]['_dateCreated'],
                '_dateModified': automatic_transcripts[0]['_dateCreated'],
                '_versions': automatic_transcripts,
            }
        supplemental[question_xpath] = question_results_by_action

        # translation
        # get source
        tagged_manual_transcripts = [{**transcript, '_actionId': 'manual_transcription'} for transcript in manual_transcripts]
        tagged_automatic_transcripts = [{**transcript, '_actionId': 'manual_translation'} for transcript in automatic_transcripts]

        all_tagged_transcripts = [*tagged_manual_transcripts, *tagged_automatic_transcripts]
        all_tagged_transcripts.sort(reverse=True, key=lambda d: d['_dateCreated'])

        most_recent_transcript_uuids_by_language = {}
        for transcript in all_tagged_transcripts:
            if most_recent_transcript_uuids_by_language.get(transcript['language']) is None:
                most_recent_transcript_uuids_by_language[transcript['language']] = {'_uuid': transcript['_uuid'], '_actionId': transcript['_actionId']}

        translations_dict = action_results.get('translation', {})
        for language_code, translations in translations_dict.items():
            pass




    return supplemental


def get_automatic_transcription(
    action_results: dict,
) -> tuple[str | None, str | None] | None:
    googlets = action_results.get('googlets', {})
    return googlets.get('languageCode', None), googlets.get('value', None)

def get_automatic_translation(action_results:dict):
    googletx = action_results.get('googletx', {})
    return googletx.get('source', None), googletx.get('languageCode', None), googletx.get('value', None)



def new_transcript_revision_from_old(old_transcript_revision_dict: dict) -> dict | None:
    # ignore bad data
    if (
        'languageCode' not in old_transcript_revision_dict
        or 'value' not in old_transcript_revision_dict
    ):
        return None
    return {
        '_dateCreated': old_transcript_revision_dict.get('dateModified', None),
        'language': old_transcript_revision_dict['languageCode'],
        'value': old_transcript_revision_dict['value'],
        '_uuid': generate_uuid_for_form(),
        '_dateAccepted': None,
    }


def separate_transcriptions(
    transcription_dict: dict,
    automatic_transcript_language: str = None,
    automatic_transcript_value: str = None,
) -> tuple[list, list]:
    if not transcription_dict:
        return [], []
    automatic_transcriptions = []
    manual_transcriptions = []
    latest_revision = new_transcript_revision_from_old(transcription_dict)
    if latest_revision:
        if (
            latest_revision['value'] == automatic_transcript_value
            and latest_revision['language'] == automatic_transcript_language
        ):
            latest_revision['status'] = 'complete'
            latest_revision['_dateAccepted'] = timezone.now()
            automatic_transcriptions.append(latest_revision)
        else:
            manual_transcriptions.append(latest_revision)

    for revision in transcription_dict.get('revisions', []):
        revision_formatted = new_transcript_revision_from_old(revision)
        if revision_formatted is None:
            continue
        if (
            revision_formatted['language'] == automatic_transcript_language
            and revision['value'] == automatic_transcript_value
        ):
            revision_formatted['status'] = 'complete'
            revision_formatted['_dateAccepted'] = timezone.now()
            automatic_transcriptions.append(revision_formatted)
        else:
            manual_transcriptions.append(revision_formatted)
    return manual_transcriptions, automatic_transcriptions

def separate_translations(translation_dict):
    if not translation_dict:
        return [],[]
