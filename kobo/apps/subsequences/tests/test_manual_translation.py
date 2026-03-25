import dateutil
import jsonschema
import pytest

from ..actions.manual_translation import ManualTranslationAction
from ..exceptions import TranscriptionNotFound
from .constants import EMPTY_SUBMISSION, EMPTY_SUPPLEMENT, QUESTION_SUPPLEMENT


def test_valid_params_pass_validation():
    params = [{'language': 'fr'}, {'language': 'es'}]
    ManualTranslationAction.validate_params(params)


def test_invalid_params_fail_validation():
    params = [{'language': 123}, {'language': 'es'}]
    with pytest.raises(jsonschema.exceptions.ValidationError):
        ManualTranslationAction.validate_params(params)


def test_valid_translation_data_passes_validation():
    action = _get_action()

    # Trivial case
    data = {'language': 'fr', 'value': 'Aucune idée'}
    action.validate_data(data)

    # No translations
    data = {'language': 'fr', 'value': ''}
    action.validate_data(data)

    # Tag translation as deleted
    data = {'language': 'fr', 'value': None}
    action.validate_data(data)


def test_invalid_translation_data_fails_validation():
    action = _get_action()

    data = {'language': 'es', 'value': 'No idea'}
    with pytest.raises(jsonschema.exceptions.ValidationError):
        action.validate_data(data)

    data = {}
    with pytest.raises(jsonschema.exceptions.ValidationError):
        action.validate_data(data)


def test_valid_result_passes_validation():
    action = _get_action()

    first = {'language': 'fr', 'value': 'un'}
    second = {'language': 'en', 'value': 'two'}
    third = {'language': 'fr', 'value': 'trois'}
    fourth = {'language': 'fr', 'value': None}
    fifth = {'language': 'en', 'value': 'fifth'}
    mock_sup_det = {}
    for data in first, second, third, fourth, fifth:
        mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, data)
    action.validate_result(mock_sup_det)


def test_invalid_result_fails_validation():
    action = _get_action()

    first = {'language': 'fr', 'value': 'un'}
    second = {'language': 'en', 'value': 'two'}
    third = {'language': 'fr', 'value': 'trois'}
    fourth = {'language': 'fr', 'value': None}
    fifth = {'language': 'en', 'value': 'fifth'}
    mock_sup_det = {}
    for data in first, second, third, fourth, fifth:
        mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, data)

    # erroneously add '_dateModified' onto a version
    first_version = mock_sup_det['en']['_versions'][0]
    first_version['_dateModified'] = first_version['_dateCreated']

    with pytest.raises(jsonschema.exceptions.ValidationError):
        action.validate_result(mock_sup_det)


def test_translation_versions_are_retained_in_supplemental_details():
    action = _get_action()

    first = {'language': 'en', 'value': 'No idea'}
    second = {'language': 'fr', 'value': 'Aucune idée'}
    third = {'language': 'en', 'value': 'No clue'}
    mock_sup_det = action.revise_data(EMPTY_SUBMISSION, EMPTY_SUPPLEMENT, first)

    assert len(mock_sup_det.keys()) == 1
    assert '_versions' in mock_sup_det['en']
    assert mock_sup_det['en']['_versions'][0]['_data']['language'] == 'en'
    assert mock_sup_det['en']['_versions'][0]['_data']['value'] == 'No idea'
    assert mock_sup_det['en']['_dateCreated'] == mock_sup_det['en']['_dateModified']

    first_time = mock_sup_det['en']['_dateCreated']

    mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, second)
    assert len(mock_sup_det.keys()) == 2
    assert '_versions' in mock_sup_det['fr']
    assert mock_sup_det['fr']['_versions'][0]['_data']['language'] == 'fr'
    assert mock_sup_det['fr']['_versions'][0]['_data']['value'] == 'Aucune idée'
    assert mock_sup_det['fr']['_dateCreated'] == mock_sup_det['fr']['_dateModified']

    mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, third)
    assert len(mock_sup_det.keys()) == 2

    # the first version should have a creation timestamp equal to that of the first
    # translation
    assert mock_sup_det['en']['_versions'][-1]['_dateCreated'] == first_time

    # versions should not list a modification timestamp
    assert '_dateModified' not in mock_sup_det['en']['_versions'][0]

    # the record itself (not version) should have an unchanged creation
    # timestamp
    assert mock_sup_det['en']['_dateCreated'] == first_time

    # the record itself should have an updated modification timestamp
    assert dateutil.parser.parse(
        mock_sup_det['en']['_dateModified']
    ) > dateutil.parser.parse(mock_sup_det['en']['_dateCreated'])


def test_setting_translation_to_empty_string():
    action = _get_action()

    first = {'language': 'fr', 'value': 'Aucune idée'}
    second = {'language': 'fr', 'value': ''}
    mock_sup_det = action.revise_data(EMPTY_SUBMISSION, EMPTY_SUPPLEMENT, first)
    assert mock_sup_det['fr']['_versions'][0]['_data']['value'] == 'Aucune idée'

    mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, second)
    assert mock_sup_det['fr']['_versions'][0]['_data']['value'] == ''
    assert mock_sup_det['fr']['_versions'][1]['_data']['value'] == 'Aucune idée'


def test_setting_translation_to_none():
    action = _get_action()

    first = {'language': 'fr', 'value': 'Aucune idée'}
    second = {'language': 'fr', 'value': None}

    mock_sup_det = action.revise_data(EMPTY_SUBMISSION, EMPTY_SUPPLEMENT, first)
    assert mock_sup_det['fr']['_versions'][0]['_data']['value'] == 'Aucune idée'

    mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, second)
    assert mock_sup_det['fr']['_versions'][0]['_data']['value'] is None
    assert mock_sup_det['fr']['_versions'][1]['_data']['value'] == 'Aucune idée'


def test_latest_version_is_first():
    action = _get_action()

    first = {'language': 'fr', 'value': 'un'}
    second = {'language': 'fr', 'value': 'deux'}
    third = {'language': 'fr', 'value': 'trois'}

    mock_sup_det = EMPTY_SUPPLEMENT
    for data in first, second, third:
        mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, data)

    assert mock_sup_det['fr']['_versions'][0]['_data']['value'] == 'trois'
    assert mock_sup_det['fr']['_versions'][1]['_data']['value'] == 'deux'
    assert mock_sup_det['fr']['_versions'][2]['_data']['value'] == 'un'


def test_cannot_revise_data_without_transcription():
    action = _get_action(question_supplement={})

    with pytest.raises(TranscriptionNotFound):
        action.revise_data(
            EMPTY_SUBMISSION,
            EMPTY_SUPPLEMENT,
            {'language': 'fr', 'value': 'un'},
        )


def test_transform_data_for_output():
    action = _get_action()
    first = {'language': 'en', 'value': 'hello'}
    second = {'language': 'en', 'value': 'hello again'}
    third = {'language': 'fr', 'value': 'bonjour'}
    mock_sup_det = EMPTY_SUPPLEMENT
    for data in first, second, third:
        mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, data)

    retrieved_data = action.retrieve_data(mock_sup_det)
    result = action.transform_data_for_output(retrieved_data)
    assert result == {
        ('translation', 'en'): {
            'value': 'hello again',
            'languageCode': 'en',
            '_sortByDate': retrieved_data['en']['_versions'][0]['_dateAccepted'],
        },
        ('translation', 'fr'): {
            'value': 'bonjour',
            'languageCode': 'fr',
            '_sortByDate': retrieved_data['fr']['_versions'][0]['_dateAccepted'],
        },
    }


def test_transform_data_for_output_with_delete():
    action = _get_action()
    first = {'language': 'en', 'value': 'hello'}
    second = {'language': 'en', 'value': 'hello again'}
    third = {'language': 'fr', 'value': 'bonjour'}
    fourth = {'language': 'en', 'value': None}
    mock_sup_det = EMPTY_SUPPLEMENT
    for data in first, second, third, fourth:
        mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, data)

    retrieved_data = action.retrieve_data(mock_sup_det)
    result = action.transform_data_for_output(retrieved_data)
    assert result == {
        ('translation', 'en'): {
            'value': None,
            'languageCode': 'en',
            '_sortByDate': retrieved_data['en']['_versions'][0]['_dateCreated'],
        },
        ('translation', 'fr'): {
            'value': 'bonjour',
            'languageCode': 'fr',
            '_sortByDate': retrieved_data['fr']['_versions'][0]['_dateAccepted'],
        },
    }


def _get_action(question_supplement=None):
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    supplement = (
        question_supplement if question_supplement is not None else QUESTION_SUPPLEMENT
    )
    action = ManualTranslationAction(
        xpath,
        params,
        prefetched_dependencies={'question_supplemental_data': supplement},
    )
    return action
