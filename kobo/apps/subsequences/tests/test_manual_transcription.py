import dateutil
import jsonschema
import pytest

from ..actions.manual_transcription import ManualTranscriptionAction
from .constants import EMPTY_SUBMISSION, EMPTY_SUPPLEMENT


def test_valid_params_pass_validation():
    params = [{'language': 'fr'}, {'language': 'es'}]
    ManualTranscriptionAction.validate_params(params)


def test_invalid_params_fail_validation():
    params = [{'language': 123}, {'language': 'es'}]
    with pytest.raises(jsonschema.exceptions.ValidationError):
        ManualTranscriptionAction.validate_params(params)


def test_valid_transcript_data_passes_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'es'}]
    action = ManualTranscriptionAction(xpath, params)

    # Trivial case
    data = {'language': 'fr', 'value': 'Aucune idée'}
    action.validate_data(data)

    # No transcript
    data = {'language': 'fr', 'value': ''}
    action.validate_data(data)

    # Transcription with locale
    data = {'language': 'fr', 'locale': 'fr-CA', 'value': 'Ché tu moé?'}

    # Tag transcript as deleted
    data = {'language': 'fr', 'value': None}
    action.validate_data(data)


def test_invalid_transcript_data_fails_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'es'}]
    action = ManualTranscriptionAction(xpath, params)
    data = {'language': 'en', 'value': 'No idea'}
    with pytest.raises(jsonschema.exceptions.ValidationError):
        action.validate_data(data)

    data = {}
    with pytest.raises(jsonschema.exceptions.ValidationError):
        action.validate_data(data)


def test_valid_result_passes_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = ManualTranscriptionAction(xpath, params)

    first = {'language': 'fr', 'value': 'un'}
    second = {'language': 'en', 'value': 'two'}
    third = {'language': 'fr', 'value': 'trois'}
    fourth = {'language': 'fr', 'value': None}
    fifth = {'language': 'en', 'value': 'fifth'}
    mock_sup_det = EMPTY_SUPPLEMENT
    for data in first, second, third, fourth, fifth:
        mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, data)
    action.validate_result(mock_sup_det)


def test_invalid_result_fails_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = ManualTranscriptionAction(xpath, params)

    first = {'language': 'fr', 'value': 'un'}
    second = {'language': 'en', 'value': 'two'}
    third = {'language': 'fr', 'value': 'trois'}
    fourth = {'language': 'fr', 'value': None}
    fifth = {'language': 'en', 'value': 'fifth'}
    mock_sup_det = EMPTY_SUPPLEMENT
    for data in first, second, third, fourth, fifth:
        mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, data)

    # erroneously add '_dateModified' onto a revision
    mock_sup_det['_versions'][0]['_dateModified'] = mock_sup_det['_versions'][0][
        '_dateCreated'
    ]

    with pytest.raises(jsonschema.exceptions.ValidationError):
        action.validate_result(mock_sup_det)


def test_transcript_versions_are_retained_in_supplemental_details():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = ManualTranscriptionAction(xpath, params)

    first = {'language': 'en', 'value': 'No idea'}
    second = {'language': 'fr', 'value': 'Aucune idée'}
    mock_sup_det = action.revise_data(EMPTY_SUBMISSION, EMPTY_SUPPLEMENT, first)

    assert mock_sup_det['_dateCreated'] == mock_sup_det['_dateModified']
    assert len(mock_sup_det['_versions']) == 1
    assert mock_sup_det['_versions'][0]['_data']['language'] == 'en'
    assert mock_sup_det['_versions'][0]['_data']['value'] == 'No idea'
    first_time = mock_sup_det['_dateCreated']

    mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, second)
    assert len(mock_sup_det['_versions']) == 2

    # the version should have a creation timestamp equal to that of the first
    # transcript
    assert mock_sup_det['_versions'][-1]['_dateCreated'] == first_time

    # versions should not list a modification timestamp
    assert '_dateModified' not in mock_sup_det['_versions'][0]

    # the record itself (not revision) should have an unchanged creation
    # timestamp
    assert mock_sup_det['_dateCreated'] == first_time

    # the record itself should have an updated modification timestamp
    assert dateutil.parser.parse(mock_sup_det['_dateModified']) > dateutil.parser.parse(
        mock_sup_det['_dateCreated']
    )


def test_setting_transcript_to_empty_string():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = ManualTranscriptionAction(xpath, params)

    first = {'language': 'fr', 'value': 'Aucune idée'}
    second = {'language': 'fr', 'value': ''}

    mock_sup_det = action.revise_data(EMPTY_SUBMISSION, EMPTY_SUPPLEMENT, first)
    assert mock_sup_det['_versions'][0]['_data']['value'] == 'Aucune idée'

    mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, second)
    assert mock_sup_det['_versions'][0]['_data']['value'] == ''
    assert mock_sup_det['_versions'][1]['_data']['value'] == 'Aucune idée'


def test_setting_transcript_to_none():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = ManualTranscriptionAction(xpath, params)

    first = {'language': 'fr', 'value': 'Aucune idée'}
    second = {'language': 'fr', 'value': None}

    mock_sup_det = action.revise_data(EMPTY_SUBMISSION, EMPTY_SUPPLEMENT, first)
    assert mock_sup_det['_versions'][0]['_data']['value'] == 'Aucune idée'

    mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, second)
    assert mock_sup_det['_versions'][0]['_data']['value'] is None
    assert mock_sup_det['_versions'][1]['_data']['value'] == 'Aucune idée'


def test_latest_revision_is_first():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = ManualTranscriptionAction(xpath, params)

    first = {'language': 'fr', 'value': 'un'}
    second = {'language': 'fr', 'value': 'deux'}
    third = {'language': 'fr', 'value': 'trois'}

    mock_sup_det = EMPTY_SUPPLEMENT
    for data in first, second, third:
        mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, data)

    assert mock_sup_det['_versions'][0]['_data']['value'] == 'trois'
    assert mock_sup_det['_versions'][1]['_data']['value'] == 'deux'
    assert mock_sup_det['_versions'][2]['_data']['value'] == 'un'


def test_update_params_only_adds_new_languages():
    xpath = 'group_name/question_name'
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = ManualTranscriptionAction(xpath, params)
    incoming_params = [{'language': 'en'}, {'language': 'es'}]
    action.update_params(incoming_params)
    assert sorted(action.languages) == ['en', 'es', 'fr']


def test_update_params_fails_if_new_params_invalid():
    xpath = 'group_name/question_name'
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = ManualTranscriptionAction(xpath, params)
    incoming_params = [{'bad': 'things'}]
    with pytest.raises(jsonschema.exceptions.ValidationError):
        action.update_params(incoming_params)
