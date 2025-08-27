import dateutil
import jsonschema
import pytest

from ..actions.manual_translation import ManualTranslationAction
from .constants import EMPTY_SUBMISSION, EMPTY_SUPPLEMENT


def test_valid_params_pass_validation():
    params = [{'language': 'fr'}, {'language': 'es'}]
    ManualTranslationAction.validate_params(params)


def test_invalid_params_fail_validation():
    params = [{'language': 123}, {'language': 'es'}]
    with pytest.raises(jsonschema.exceptions.ValidationError):
        ManualTranslationAction.validate_params(params)


def test_valid_translation_data_passes_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'es'}]
    action = ManualTranslationAction(xpath, params)
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
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'es'}]
    action = ManualTranslationAction(xpath, params)

    data = {'language': 'en', 'value': 'No idea'}
    with pytest.raises(jsonschema.exceptions.ValidationError):
        action.validate_data(data)

    data = {}
    with pytest.raises(jsonschema.exceptions.ValidationError):
        action.validate_data(data)


def test_valid_result_passes_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = ManualTranslationAction(xpath, params)

    first = {'language': 'fr', 'value': 'un'}
    second = {'language': 'en', 'value': 'two'}
    third = {'language': 'fr', 'value': 'trois'}
    fourth = {'language': 'fr', 'value': None}
    fifth = {'language': 'en', 'value': 'fifth'}
    mock_sup_det = action.action_class_config.default_type
    for data in first, second, third, fourth, fifth:
        mock_sup_det = action.revise_data(EMPTY_SUBMISSION, EMPTY_SUPPLEMENT, mock_sup_det, data)
    action.validate_result(mock_sup_det)


def test_invalid_result_fails_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = ManualTranslationAction(xpath, params)

    first = {'language': 'fr', 'value': 'un'}
    second = {'language': 'en', 'value': 'two'}
    third = {'language': 'fr', 'value': 'trois'}
    fourth = {'language': 'fr', 'value': None}
    fifth = {'language': 'en', 'value': 'fifth'}
    mock_sup_det = action.action_class_config.default_type
    for data in first, second, third, fourth, fifth:
        mock_sup_det = action.revise_data(EMPTY_SUBMISSION, EMPTY_SUPPLEMENT, mock_sup_det, data)

    # erroneously add '_dateModified' onto a revision
    first_revision = mock_sup_det[0]['_revisions'][0]
    first_revision['_dateModified'] = first_revision['_dateCreated']

    with pytest.raises(jsonschema.exceptions.ValidationError):
        action.validate_result(mock_sup_det)


def test_translation_revisions_are_retained_in_supplemental_details():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = ManualTranslationAction(xpath, params)

    first = {'language': 'en', 'value': 'No idea'}
    second = {'language': 'fr', 'value': 'Aucune idée'}
    third = {'language': 'en', 'value': 'No clue'}
    mock_sup_det = action.revise_data(
        EMPTY_SUBMISSION, EMPTY_SUPPLEMENT, action.action_class_config.default_type, first
    )

    assert len(mock_sup_det) == 1
    assert mock_sup_det[0]['language'] == 'en'
    assert mock_sup_det[0]['value'] == 'No idea'
    assert mock_sup_det[0]['_dateCreated'] == mock_sup_det[0]['_dateModified']
    assert '_revisions' not in mock_sup_det[0]
    first_time = mock_sup_det[0]['_dateCreated']

    mock_sup_det = action.revise_data(EMPTY_SUBMISSION, EMPTY_SUPPLEMENT,mock_sup_det, second)
    assert len(mock_sup_det) == 2
    assert mock_sup_det[1]['language'] == 'fr'
    assert mock_sup_det[1]['value'] == 'Aucune idée'
    assert mock_sup_det[1]['_dateCreated'] == mock_sup_det[1]['_dateModified']
    assert '_revisions' not in mock_sup_det[1]

    mock_sup_det = action.revise_data(EMPTY_SUBMISSION, EMPTY_SUPPLEMENT,mock_sup_det, third)
    assert len(mock_sup_det) == 2

    # the revision should encompass the first translation
    assert mock_sup_det[0]['_revisions'][0].items() >= first.items()

    # the revision should have a creation timestamp equal to that of the first
    # translation
    assert mock_sup_det[0]['_revisions'][0]['_dateCreated'] == first_time

    # revisions should not list a modification timestamp
    assert '_dateModified' not in mock_sup_det[0]['_revisions'][0]

    # the record itself (not revision) should have an unchanged creation
    # timestamp
    assert mock_sup_det[0]['_dateCreated'] == first_time

    # the record itself should have an updated modification timestamp
    assert dateutil.parser.parse(
        mock_sup_det[0]['_dateModified']
    ) > dateutil.parser.parse(mock_sup_det[0]['_dateCreated'])

    # the record itself should encompass the second translation
    assert mock_sup_det[0].items() >= third.items()


def test_setting_translation_to_empty_string():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = ManualTranslationAction(xpath, params)

    first = {'language': 'fr', 'value': 'Aucune idée'}
    second = {'language': 'fr', 'value': ''}
    mock_sup_det = action.revise_data(
        EMPTY_SUBMISSION, EMPTY_SUPPLEMENT, action.action_class_config.default_type, first
    )
    assert mock_sup_det[0]['value'] == 'Aucune idée'

    mock_sup_det = action.revise_data(EMPTY_SUBMISSION, EMPTY_SUPPLEMENT,mock_sup_det, second)
    assert mock_sup_det[0]['value'] == ''
    assert mock_sup_det[0]['_revisions'][0]['value'] == 'Aucune idée'


def test_setting_translation_to_none():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = ManualTranslationAction(xpath, params)

    first = {'language': 'fr', 'value': 'Aucune idée'}
    second = {'language': 'fr', 'value': None}

    mock_sup_det = action.revise_data(
        EMPTY_SUBMISSION, EMPTY_SUPPLEMENT, action.action_class_config.default_type, first
    )
    assert mock_sup_det[0]['value'] == 'Aucune idée'

    mock_sup_det = action.revise_data(EMPTY_SUBMISSION, EMPTY_SUPPLEMENT,mock_sup_det, second)
    assert mock_sup_det[0]['value'] is None
    assert mock_sup_det[0]['_revisions'][0]['value'] == 'Aucune idée'


def test_latest_revision_is_first():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = ManualTranslationAction(xpath, params)

    first = {'language': 'fr', 'value': 'un'}
    second = {'language': 'fr', 'value': 'deux'}
    third = {'language': 'fr', 'value': 'trois'}

    mock_sup_det = action.action_class_config.default_type
    for data in first, second, third:
        mock_sup_det = action.revise_data(EMPTY_SUBMISSION, EMPTY_SUPPLEMENT,mock_sup_det, data)

    assert mock_sup_det[0]['value'] == 'trois'
    assert mock_sup_det[0]['_revisions'][0]['value'] == 'deux'
    assert mock_sup_det[0]['_revisions'][1]['value'] == 'un'
