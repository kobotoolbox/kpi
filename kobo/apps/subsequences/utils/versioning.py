import uuid

from django.utils import timezone

from ..constants import SCHEMA_VERSIONS


def migrate_advanced_features(advanced_features: dict) -> dict | None:

    if advanced_features.get('_version') == SCHEMA_VERSIONS[0]:
        return advanced_features

    migrated_advanced_features = {'_version': SCHEMA_VERSIONS[0], '_actionConfigs': {}}

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

    return migrated_advanced_features


def migrate_qual_data(supplemental_data: dict) -> dict | None:
    """
    Convert old `qual` format to new format

    OLD: {'qual': [{'val': 'answer', 'uuid': 'q-uuid', 'type': 'qual_text'}, ...]}
    NEW: {'qual': {'q-uuid': {'_versions': [...], '_dateCreated': '...', ...}}}
    """
    qual_array = supplemental_data.get('qual')
    if not isinstance(qual_array, list) or not qual_array:
        return None

    now = timezone.now().isoformat()
    new_qual_dict = {}

    for item in qual_array:
        if 'uuid' not in item or 'val' not in item:
            continue

        question_uuid = item.get('uuid')
        value = item.get('val')

        new_version = {
            '_data': {
                'uuid': question_uuid,
                'value': value
            },
            '_dateCreated': now,
            '_dateAccepted': now,
            '_uuid': str(uuid.uuid4())
        }

        new_qual_dict[question_uuid] = {
            '_dateCreated': now,
            '_dateModified': now,
            '_versions': [new_version]
        }

    return new_qual_dict


def migrate_submission_supplementals(supplemental_data: dict) -> dict | None:
    if supplemental_data.get('_version') == SCHEMA_VERSIONS[0]:
        return supplemental_data
    supplemental = {
        '_version': SCHEMA_VERSIONS[0],
    }
    for question_xpath, action_results in supplemental_data.items():
        question_results_by_action = {}

        # get all the automatic result data
        automatic_transcript = action_results.get('googlets', {})
        automatic_transcript_language = automatic_transcript.get('languageCode')
        automatic_transcript_value = automatic_transcript.get('value')
        automatic_translation = action_results.get('googletx', {})
        automatic_translation_language = automatic_translation.get('languageCode')
        automatic_translation_value = automatic_translation.get('value')
        automatic_translation_source_language = automatic_translation.get('source')

        # divide transcripts into manual and automatic
        manual_transcripts, automatic_transcripts = (
            _separate_manual_and_automatic_versions(
                action_results.get('transcript'),
                automatic_transcript_language,
                automatic_transcript_value,
            )
        )

        if len(manual_transcripts) > 0:
            question_results_by_action['manual_transcription'] = (
                _version_list_to_summary_dict(manual_transcripts)
            )
        if len(automatic_transcripts) > 0:
            question_results_by_action['automatic_google_transcription'] = (
                _version_list_to_summary_dict(automatic_transcripts)
            )

        # process translations
        translations_dict = action_results.get('translation', {})
        automatic_translations = {}
        manual_translations = {}

        # divide translations into manual and automatic by language
        for language_code, translations in translations_dict.items():
            manual_translations_for_language, automatic_translations_for_language = (
                _separate_manual_and_automatic_versions(
                    translations,
                    automatic_translation_language,
                    automatic_translation_value,
                    language_code,
                )
            )

            all_tagged_transcripts = _combine_source_transcripts(
                manual_transcripts, automatic_transcripts
            )
            if len(automatic_translations_for_language) > 0:
                _add_translation_sources(
                    automatic_translations_for_language,
                    all_tagged_transcripts,
                    automatic_translation_source_language,
                )
                automatic_translations[language_code] = _version_list_to_summary_dict(
                    automatic_translations_for_language
                )
            if len(manual_translations_for_language) > 0:
                _add_translation_sources(
                    manual_translations_for_language, all_tagged_transcripts
                )
                manual_translations[language_code] = _version_list_to_summary_dict(
                    manual_translations_for_language
                )
        if automatic_translations != {}:
            question_results_by_action['automatic_google_translation'] = (
                automatic_translations
            )
        if manual_translations != {}:
            question_results_by_action['manual_translation'] = manual_translations

        if 'qual' in action_results:
            qual_migration = migrate_qual_data(action_results)
            if qual_migration:
                question_results_by_action['qual'] = qual_migration

        supplemental[question_xpath] = question_results_by_action

    return supplemental


def set_version(schema: dict) -> dict:
    schema['_version'] = SCHEMA_VERSIONS[0]
    return schema


def _add_translation_sources(
    version_list, all_tagged_transcripts, automatic_translation_source_language=None
):
    for translation in version_list:
        # determine and record the most likely source transcript
        source = _determine_source_transcript(
            translation,
            all_tagged_transcripts,
            automatic_source_language=automatic_translation_source_language,
        )
        translation['_dependency'] = {
            '_uuid': source['_uuid'],
            '_actionId': source['_actionId'],
        }


def _combine_source_transcripts(manual_transcripts, automatic_transcripts):
    # Combine manual and automatic transcripts and sort by dateCreated descending
    # tag them with the action so we don't lose track
    tagged_manual_transcripts = [
        {**transcript, '_actionId': 'manual_transcription'}
        for transcript in manual_transcripts
    ]
    tagged_automatic_transcripts = [
        {**transcript, '_actionId': 'automatic_google_transcription'}
        for transcript in automatic_transcripts
    ]

    all_tagged_transcripts = [*tagged_manual_transcripts, *tagged_automatic_transcripts]
    all_tagged_transcripts.sort(reverse=True, key=lambda d: d['_dateCreated'])
    return all_tagged_transcripts


def _determine_source_transcript(
    translation_revision, all_transcripts, automatic_source_language=None
):
    if automatic_source_language:  # we know the source language
        transcripts_matching_language = [
            transcript
            for transcript in all_transcripts
            if transcript['language'] == automatic_source_language
        ]
        for transcript in transcripts_matching_language:
            # is there a transcript in the source language created earlier than the
            # translation?
            if transcript['_dateCreated'] < translation_revision['_dateCreated']:
                return transcript
        # if not, is there *any* transcript in the source language? take the most
        # recent one
        if len(transcripts_matching_language) > 0:
            return transcripts_matching_language[0]
    else:
        # is there a transcript older than the translation?
        for transcript in all_transcripts:
            if transcript['_dateCreated'] < translation_revision['_dateCreated']:
                return transcript
    # default to the most recent transcript
    return all_transcripts[0]


def _new_revision_from_old(old_transcript_revision_dict: dict) -> dict | None:
    now = timezone.now().isoformat()
    # ignore bad data
    if (
        'languageCode' not in old_transcript_revision_dict
        or 'value' not in old_transcript_revision_dict
    ):
        return None
    return {
        '_dateCreated': old_transcript_revision_dict.get('dateModified'),
        'language': old_transcript_revision_dict['languageCode'],
        'value': old_transcript_revision_dict['value'],
        '_uuid': str(uuid.uuid4()),
        # all preexisting translations/transcripts are considered accepted
        '_dateAccepted': now,
    }


def _separate_manual_and_automatic_versions(
    old_action_dictionary,
    automatic_result_language,
    automatic_result_value,
    # translations have an expected language
    language=None,
):
    automatic_versions = []
    manual_versions = []
    latest_revision = {
        key: val
        for key, val in old_action_dictionary.items()
        if key in ['value', 'languageCode', 'dateModified']
    }
    # add the latest revision to the list of all revisions for easier processing
    all_revisions = [latest_revision, *old_action_dictionary.get('revisions', [])]
    for revision in all_revisions:
        if language:
            # force the expected language if given
            revision['languageCode'] = language
        revision_formatted = _new_revision_from_old(revision)
        if revision_formatted is None:
            continue
        # if the language and value match that of the automatic result,
        # assume this one was generated automatically
        matches_automatic_result = (
            revision_formatted['language'] == automatic_result_language
            and revision_formatted['value'] == automatic_result_value
        )
        correct_version_list_to_append = (
            automatic_versions if matches_automatic_result else manual_versions
        )
        if matches_automatic_result:
            # automatic versions also need a status
            revision_formatted['status'] = 'complete'
        correct_version_list_to_append.append(revision_formatted)

    # they should be sorted anyway, but just make sure in case the input values
    # weren't sorted correctly
    manual_versions.sort(reverse=True, key=lambda d: d['_dateCreated'])
    automatic_versions.sort(reverse=True, key=lambda d: d['_dateCreated'])

    return manual_versions, automatic_versions


def _version_list_to_summary_dict(list_of_versions: list[dict]) -> dict:
    return {
        '_dateCreated': list_of_versions[-1]['_dateCreated'],
        '_dateModified': list_of_versions[0]['_dateCreated'],
        '_versions': list_of_versions,
    }
