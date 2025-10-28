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

        # translation
        # determine what to use as the source transcript
        most_recent_transcript, most_recent_transcript_by_language = (
            determine_source_transcripts(manual_transcripts, automatic_transcripts)
        )
        (
            automatic_translation_source_language,
            automatic_translation_language,
            automatic_translation_value,
        ) = get_automatic_translation(action_results)

        translations_dict = action_results.get('translation', {})
        automatic_translations = {}
        manual_translations = {}
        for language_code, translations in translations_dict.items():
            automatic_translations_for_language, manual_translations_for_language = separate_translations(
                language_code,
                translations,
                automatic_translation_source_language,
                automatic_translation_language,
                automatic_translation_value,
                most_recent_transcript,
                most_recent_transcript_by_language,
            )
            automatic_translations[language_code] = automatic_translations_for_language
            manual_translations[language_code] = manual_translations_for_language
        question_results_by_action['automatic_translation'] = automatic_translations
        question_results_by_action['manual_translation'] = manual_translations
        supplemental[question_xpath] = question_results_by_action


    return supplemental


def determine_source_transcripts(manual_transcripts, automatic_transcripts):
    # First combine manual and automatic transcripts and sort by dateCreated descending
    # tag them with the action so we don't lose track
    tagged_manual_transcripts = [
        {**transcript, '_actionId': 'manual_transcription'}
        for transcript in manual_transcripts
    ]
    tagged_automatic_transcripts = [
        {**transcript, '_actionId': 'automatic_translation'}
        for transcript in automatic_transcripts
    ]

    all_tagged_transcripts = [*tagged_manual_transcripts, *tagged_automatic_transcripts]
    all_tagged_transcripts.sort(reverse=True, key=lambda d: d['_dateCreated'])

    # take the most recent transcript, manual or automatic, by language
    most_recent_transcript_uuids_by_language = {}
    for transcript in all_tagged_transcripts:
        if most_recent_transcript_uuids_by_language.get(transcript['language']) is None:
            most_recent_transcript_uuids_by_language[transcript['language']] = {
                '_uuid': transcript['_uuid'],
                '_actionId': transcript['_actionId'],
            }

    # we don't always know the source language of a translation, so also get the most recent transcript overall
    most_recent_transcript_overall = all_tagged_transcripts[0]
    most_recent_transcript_overall = {
        '_uuid': most_recent_transcript_overall['_uuid'],
        '_actionId': most_recent_transcript_overall['_actionId'],
    }
    return most_recent_transcript_overall, most_recent_transcript_uuids_by_language


def get_automatic_transcription(
    action_results: dict,
) -> tuple[str | None, str | None] | None:
    googlets = action_results.get('googlets', {})
    return googlets.get('languageCode', None), googlets.get('value', None)

def get_automatic_translation(action_results:dict):
    googletx = action_results.get('googletx', {})
    return (
        googletx.get('source', None),
        googletx.get('languageCode', None),
        googletx.get('value', None),
    )


def new_revision_from_old(old_transcript_revision_dict: dict) -> dict | None:
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
    latest_revision = new_revision_from_old(transcription_dict)
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
        revision_formatted = new_revision_from_old(revision)
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


def separate_translations(
    language,
    translation_dict,
    automatic_translation_source_language: str = None,
    automatic_translation_language: str = None,
    automatic_translation_value: str = None,
    most_recent_transcript=None,
    most_recent_transcript_by_language=None,
):
    """
    {'es': {'dateCreated': '2025-10-22T14:30:38Z',
                                   'dateModified': '2025-10-22T17:10:23Z',
                                   'languageCode': 'es',
                                   'revisions': [{'dateModified': '2025-10-22T14:30:38Z',
                                                  'languageCode': 'es',
                                                  'value': 'Este es un '
                                                           'audio que '
                                                           'estoy '
                                                           'intentando '
                                                           'transcribir.'}],
                                   'value': 'Este es un audio que '
                                            'estoy intentando '
                                            'transcribir pero yo lo edité'}}
    """
    automatic_translations = []
    manual_translations = []
    latest_revision = new_revision_from_old(translation_dict)
    if latest_revision:
        if (
            latest_revision['value'] == automatic_translation_value
            and language == automatic_translation_language
        ):
            latest_revision['status'] = 'complete'
            latest_revision['_dateAccepted'] = timezone.now()
            source = most_recent_transcript_by_language.get(
                automatic_translation_source_language, most_recent_transcript
            )
            latest_revision['source'] = source
            automatic_translations.append(latest_revision)
        else:
            latest_revision['source'] = most_recent_transcript
            manual_translations.append(latest_revision)

    for revision in translation_dict.get('revisions', []):
        revision_formatted = new_revision_from_old(revision)
        if revision_formatted is None:
            continue
        if (
            language == automatic_translation_language
            and revision['value'] == automatic_translation_value
        ):
            revision_formatted['status'] = 'complete'
            revision_formatted['_dateAccepted'] = timezone.now()
            source = most_recent_transcript_by_language.get(
                automatic_translation_source_language, most_recent_transcript
            )
            revision_formatted['source'] = source
            automatic_translations.append(revision_formatted)
        else:
            revision_formatted['source'] = most_recent_transcript
            manual_translations.append(revision_formatted)
    return manual_translations, automatic_translations
