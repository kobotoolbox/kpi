from unittest.mock import MagicMock, patch

import dateutil
import jsonschema
import pytest

from ..actions.automated_google_transcription import AutomatedGoogleTranscriptionAction
from .constants import EMPTY_SUBMISSION, EMPTY_SUPPLEMENT


def test_valid_params_pass_validation():
    params = [{'language': 'fr'}, {'language': 'es'}]
    AutomatedGoogleTranscriptionAction.validate_params(params)


def test_invalid_params_fail_validation():
    params = [{'language': 123}, {'language': 'es'}]
    with pytest.raises(jsonschema.exceptions.ValidationError):
        AutomatedGoogleTranscriptionAction.validate_params(params)


def test_valid_user_data_passes_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'es'}]
    action = AutomatedGoogleTranscriptionAction(xpath, params)

    allowed_data = [
        # Trivial case
        {'language': 'fr'},
        # Transcription with locale
        {'language': 'fr', 'locale': 'fr-CA'},
        # Delete transcript
        {'language': 'fr', 'value': None},
        # Delete transcript with locale
        {'language': 'fr', 'locale': 'fr-CA', 'value': None},
        # Accept transcript
        {'language': 'fr', 'accepted': True},
        # Accept translat with locale
        {'language': 'fr', 'locale': 'fr-CA', 'accepted': True},
    ]

    for data in allowed_data:
        action.validate_data(data)


def test_valid_automated_transcription_data_passes_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'es'}]

    action = AutomatedGoogleTranscriptionAction(xpath, params)

    allowed_data = [
        # Trivial case
        {'language': 'fr', 'value': 'Aucune idée', 'status': 'complete'},
        {
            'language': 'fr',
            'locale': 'fr-FR',
            'value': 'Aucune idée',
            'status': 'complete',
        },
        # Delete transcript
        {'language': 'fr', 'value': None, 'status': 'deleted'},
        {'language': 'fr', 'locale': 'fr-CA', 'value': None, 'status': 'deleted'},
        # Action in progress no value
        {'language': 'es', 'status': 'in_progress'},
        {'language': 'es', 'locale': 'fr-CA', 'status': 'in_progress'},
        # Store error with status
        {'language': 'es', 'status': 'failed', 'error': 'Transcription failed'},
        {
            'language': 'es',
            'locale': 'fr-CA',
            'status': 'failed',
            'error': 'Transcription failed',
        },
    ]

    for data in allowed_data:
        action.validate_automated_data(data)


def test_invalid_user_data_fails_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'es'}]
    action = AutomatedGoogleTranscriptionAction(xpath, params)

    invalid_data = [
        # Wrong language
        {'language': 'en'},
        # Empty data
        {},
        # Cannot push a transcription
        {'language': 'fr', 'value': 'Aucune idée'},
        # Cannot push a transcription
        {'language': 'fr', 'value': 'Aucune idée', 'status': 'complete'},
        # Cannot push a transcription
        {'language': 'fr', 'value': 'Aucune idée', 'status': 'in_progress'},
        # Cannot push a transcription
        {'language': 'fr', 'value': 'Aucune idée', 'status': 'failed'},
        # Cannot push a status
        {'language': 'fr', 'status': 'in_progress'},
        # Cannot pass value and accepted at the same time
        {'language': 'fr', 'value': None, 'accepted': False},
    ]

    for data in invalid_data:
        with pytest.raises(jsonschema.exceptions.ValidationError):
            action.validate_data(data)


def test_invalid_automated_data_fails_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'es'}]
    action = AutomatedGoogleTranscriptionAction(xpath, params)

    invalid_data = [
        # Wrong language
        {'language': 'en', 'value': 'No idea', 'status': 'complete'},
        # Cannot pass a value while in progress
        {'language': 'es', 'value': 'Ni idea', 'status': 'in_progress'},
        # Cannot pass an empty object
        {},
        # Cannot accept an empty transcription
        {'language': 'es', 'accepted': True},
        # Cannot deny an empty transcription
        {'language': 'es', 'accepted': False},
        # Cannot pass value and accepted at the same time
        {'language': 'es', 'value': None, 'accepted': False},
        # Cannot have a value while in progress
        {'language': 'es', 'value': 'Ni idea', 'status': 'in_progress'},
        # Missing error property
        {'language': 'es', 'status': 'failed'},
        # Delete transcript without status
        {'language': 'fr', 'value': None},
        # Delete transcript with locale without status
        {'language': 'fr', 'locale': 'fr-CA', 'value': None},
        # failed with no status
        {'language': 'es', 'error': 'Transcription failed'},
        # failed with no error
        {'language': 'es', 'status': 'failed'},
    ]

    for data in invalid_data:
        with pytest.raises(jsonschema.exceptions.ValidationError):
            action.validate_automated_data(data)


def test_valid_result_passes_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'es'}]
    action = AutomatedGoogleTranscriptionAction(xpath, params)

    first = {'language': 'fr', 'value': 'un'}
    second = {'language': 'es', 'value': 'dos'}
    third = {'language': 'fr', 'value': 'trois'}
    fourth = {'language': 'fr', 'accepted': True}
    fifth = {'language': 'fr', 'value': None}
    six = {'language': 'es', 'value': 'seis'}
    mock_sup_det = EMPTY_SUPPLEMENT

    mock_service = MagicMock()
    with patch(
        'kobo.apps.subsequences.actions.automated_google_transcription.GoogleTranscriptionService',  # noqa
        return_value=mock_service,
    ):
        for data in first, second, third, fourth, fifth, six:
            value = data.get('value', '')
            # The 'value' field is not allowed in the payload, except when its
            # value is None.
            if value:
                del data['value']

            mock_service.process_data.return_value = {
                'value': value,
                'status': 'complete',
            }
            mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, data)

        action.validate_result(mock_sup_det)

    assert '_dateAccepted' in mock_sup_det['_versions'][2]
    assert mock_sup_det['_versions'][1]['status'] == 'deleted'


def test_acceptance_does_not_produce_versions():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = AutomatedGoogleTranscriptionAction(xpath, params)

    first = {'language': 'fr', 'value': 'un'}
    second = {'language': 'fr', 'accepted': True}
    third = {'language': 'fr', 'accepted': False}
    mock_sup_det = EMPTY_SUPPLEMENT

    mock_service = MagicMock()
    with patch(
        'kobo.apps.subsequences.actions.automated_google_transcription.GoogleTranscriptionService',  # noqa
        return_value=mock_service,
    ):
        for data in first, second, third:
            value = data.get('value', '')
            # The 'value' field is not allowed in the payload, except when its
            # value is None.
            if value:
                del data['value']

            mock_service.process_data.return_value = {
                'value': value,
                'status': 'complete',
            }
            mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, data)
            assert '_versions' in mock_sup_det
            if data.get('value') is None:
                is_date_accepted_present = (
                    mock_sup_det['_versions'][0].get('_dateAccepted')
                    is None
                )
                assert is_date_accepted_present is not bool(data.get('accepted'))

        action.validate_result(mock_sup_det)


def test_invalid_result_fails_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'es'}]
    action = AutomatedGoogleTranscriptionAction(xpath, params)

    first = {'language': 'fr', 'value': 'un'}
    second = {'language': 'es', 'value': 'dos'}
    third = {'language': 'fr', 'value': 'trois'}
    fourth = {'language': 'fr', 'accepted': True}
    fifth = {'language': 'fr', 'value': None}
    six = {'language': 'es', 'value': 'seis'}
    mock_sup_det = EMPTY_SUPPLEMENT

    mock_service = MagicMock()
    with patch(
        'kobo.apps.subsequences.actions.automated_google_transcription.GoogleTranscriptionService',  # noqa
        return_value=mock_service,
    ):
        for data in first, second, third, fourth, fifth, six:
            value = data.get('value', '')
            # The 'value' field is not allowed in the payload, except when its
            # value is None.
            if value:
                del data['value']

            mock_service.process_data.return_value = {
                'value': value,
                'status': 'complete',
            }
            mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, data)

        action.validate_result(mock_sup_det)

    # erroneously add '_dateModified' onto a version
    first_version = mock_sup_det['_versions'][0]
    first_version['_dateModified'] = first_version['_dateCreated']

    with pytest.raises(jsonschema.exceptions.ValidationError):
        action.validate_result(mock_sup_det)


def test_transcription_versions_are_retained_in_supplemental_details():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'es'}]
    action = AutomatedGoogleTranscriptionAction(xpath, params)

    first = {'language': 'es', 'value': 'Ni idea'}
    second = {'language': 'fr', 'value': 'Aucune idée'}
    mock_service = MagicMock()
    with patch(
        'kobo.apps.subsequences.actions.automated_google_transcription.GoogleTranscriptionService',  # noqa
        return_value=mock_service,
    ):
        value = first.pop('value', None)
        mock_service.process_data.return_value = {'value': value, 'status': 'complete'}
        mock_sup_det = action.revise_data(EMPTY_SUBMISSION, EMPTY_SUPPLEMENT, first)

    assert mock_sup_det['_versions'][0]['language'] == 'es'
    assert mock_sup_det['_versions'][0]['value'] == 'Ni idea'
    assert mock_sup_det['_dateCreated'] == mock_sup_det['_dateModified']
    assert 'value' not in mock_sup_det
    assert 'language' not in mock_sup_det
    first_time = mock_sup_det['_dateCreated']

    with patch(
        'kobo.apps.subsequences.actions.automated_google_transcription.GoogleTranscriptionService',  # noqa
        return_value=mock_service,
    ):
        value = second.pop('value', None)
        mock_service.process_data.return_value = {'value': value, 'status': 'complete'}
        mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, second)

    assert len(mock_sup_det['_versions']) == 2

    # the first version should have a creation timestamp equal to that of the first
    # transcript
    assert mock_sup_det['_versions'][1]['_dateCreated'] == first_time

    # versions should not list a modification timestamp
    assert '_dateModified' not in mock_sup_det['_versions'][0]

    # the record itself (not version) should have an unchanged creation
    # timestamp
    assert mock_sup_det['_dateCreated'] == first_time

    # the record itself should have an updated modification timestamp
    assert dateutil.parser.parse(mock_sup_det['_dateModified']) > dateutil.parser.parse(
        mock_sup_det['_dateCreated']
    )


def test_latest_version_is_first():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = AutomatedGoogleTranscriptionAction(xpath, params)

    first = {'language': 'fr', 'value': 'un'}
    second = {'language': 'fr', 'value': 'deux'}
    third = {'language': 'fr', 'value': 'trois'}

    mock_sup_det = EMPTY_SUPPLEMENT
    mock_service = MagicMock()
    with patch(
        'kobo.apps.subsequences.actions.automated_google_transcription.GoogleTranscriptionService',  # noqa
        return_value=mock_service,
    ):
        for data in first, second, third:
            value = data.pop('value')
            mock_service.process_data.return_value = {
                'value': value,
                'status': 'complete',
            }
            mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, data)

    assert mock_sup_det['_versions'][0]['value'] == 'trois'
    assert mock_sup_det['_versions'][1]['value'] == 'deux'
    assert mock_sup_det['_versions'][2]['value'] == 'un'
