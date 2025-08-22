import copy
import dateutil
import jsonschema
import pytest

from ..actions.manual_transcription import ManualTranscriptionAction


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
    data = {'language': 'fr', 'transcript': 'Ne pas idée'}
    action.validate_data(data)


def test_invalid_transcript_data_fails_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'es'}]
    action = ManualTranscriptionAction(xpath, params)
    data = {'language': 'en', 'transcript': 'No idea'}
    with pytest.raises(jsonschema.exceptions.ValidationError):
        action.validate_data(data)

def test_valid_result_passes_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = ManualTranscriptionAction(xpath, params)

    first = {'language': 'fr', 'transcript': 'un'}
    second = {'language': 'en', 'transcript': 'two'}
    third = {'language': 'fr', 'transcript': 'trois'}
    fourth = {}
    fifth = {'language': 'en', 'transcript': 'fifth'}
    mock_sup_det = {}
    for data in first, second, third, fourth, fifth:
        mock_sup_det = action.revise_field({}, mock_sup_det, data)
    action.validate_result(mock_sup_det)

def test_invalid_result_fails_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = ManualTranscriptionAction(xpath, params)

    first = {'language': 'fr', 'transcript': 'un'}
    second = {'language': 'en', 'transcript': 'two'}
    third = {'language': 'fr', 'transcript': 'trois'}
    fourth = {}
    fifth = {'language': 'en', 'transcript': 'fifth'}
    mock_sup_det = {}
    for data in first, second, third, fourth, fifth:
        mock_sup_det = action.revise_field({}, mock_sup_det, data)

    # erroneously add '_dateModified' onto a revision
    mock_sup_det['_revisions'][0]['_dateModified'] = mock_sup_det['_revisions'][0]['_dateCreated']

    with pytest.raises(jsonschema.exceptions.ValidationError):
        action.validate_result(mock_sup_det)


def test_transcript_is_stored_in_supplemental_details():
    pass


def test_transcript_revisions_are_retained_in_supplemental_details():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = ManualTranscriptionAction(xpath, params)

    first = {'language': 'en', 'transcript': 'No idea'}
    second = {'language': 'fr', 'transcript': "Pas d'idée"}

    mock_sup_det = action.revise_field({}, {}, first)

    assert mock_sup_det['language'] == 'en'
    assert mock_sup_det['transcript'] == 'No idea'
    assert mock_sup_det['_dateCreated'] == mock_sup_det['_dateModified']
    assert '_revisions' not in mock_sup_det
    first_time = mock_sup_det['_dateCreated']

    mock_sup_det = action.revise_field({}, mock_sup_det, second)
    assert len(mock_sup_det['_revisions']) == 1

    # the revision should encompass the first transcript
    assert mock_sup_det['_revisions'][0].items() >= first.items()

    # the revision should have a creation timestamp equal to that of the first
    # transcript
    assert mock_sup_det['_revisions'][0]['_dateCreated'] == first_time

    # revisions should not list a modification timestamp
    assert '_dateModified' not in mock_sup_det['_revisions']

    # the record itself (not revision) should have an unchanged creation
    # timestamp
    assert mock_sup_det['_dateCreated'] == first_time

    # the record itself should have an updated modification timestamp
    assert dateutil.parser.parse(
        mock_sup_det['_dateModified']
    ) > dateutil.parser.parse(mock_sup_det['_dateCreated'])

    # the record itself should encompass the second transcript
    assert mock_sup_det.items() >= second.items()

def test_setting_transcript_to_empty_string():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = ManualTranscriptionAction(xpath, params)

    first = {'language': 'fr', 'transcript': "Pas d'idée"}
    second = {'language': 'fr', 'transcript': ''}

    mock_sup_det = action.revise_field({}, {}, first)
    assert mock_sup_det['transcript'] == "Pas d'idée"

    mock_sup_det = action.revise_field({}, mock_sup_det, second)
    assert mock_sup_det['transcript'] == ''
    assert mock_sup_det['_revisions'][0]['transcript'] == "Pas d'idée"

def test_setting_transcript_to_empty_object():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = ManualTranscriptionAction(xpath, params)

    first = {'language': 'fr', 'transcript': "Pas d'idée"}
    second = {}

    mock_sup_det = action.revise_field({}, {}, first)
    assert mock_sup_det['transcript'] == "Pas d'idée"

    mock_sup_det = action.revise_field({}, mock_sup_det, second)
    assert 'transcript' not in mock_sup_det
    assert mock_sup_det['_revisions'][0]['transcript'] == "Pas d'idée"

def test_latest_revision_is_first():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = ManualTranscriptionAction(xpath, params)

    first = {'language': 'fr', 'transcript': 'un'}
    second = {'language': 'fr', 'transcript': 'deux'}
    third = {'language': 'fr', 'transcript': 'trois'}

    mock_sup_det = {}
    for data in first, second, third:
        mock_sup_det = action.revise_field({}, mock_sup_det, data)

    assert mock_sup_det['transcript'] == 'trois'
    assert mock_sup_det['_revisions'][0]['transcript'] == 'deux'
    assert mock_sup_det['_revisions'][1]['transcript'] == 'un'
