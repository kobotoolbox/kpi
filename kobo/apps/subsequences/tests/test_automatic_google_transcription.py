from unittest.mock import MagicMock, patch

import dateutil
import jsonschema
import pytest

from ..actions.automatic_google_transcription import AutomaticGoogleTranscriptionAction
from .constants import EMPTY_SUBMISSION, EMPTY_SUPPLEMENT


def test_valid_params_pass_validation():
    params = [{'language': 'fr'}, {'language': 'es'}]
    AutomaticGoogleTranscriptionAction.validate_params(params)


def test_invalid_params_fail_validation():
    params = [{'language': 123}, {'language': 'es'}]
    with pytest.raises(jsonschema.exceptions.ValidationError):
        AutomaticGoogleTranscriptionAction.validate_params(params)


def test_valid_user_data_passes_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'es'}]

    action = AutomaticGoogleTranscriptionAction(xpath, params)

    allowed_data = [
        # Trivial case
        {'language': 'fr'},
        # Transcription with locale
        {'language': 'fr', 'locale': 'fr-CA'},
        # Delete transcript
        {'language': 'fr', 'value': None},
        # Delete transcript with locale
        {'language': 'fr', 'locale': 'fr-CA', 'value': None},
        # Accept translation
        {'language': 'fr', 'accepted': True},
        # Accept translation with locale
        {'language': 'fr', 'locale': 'fr-CA', 'accepted': True},
    ]

    for data in allowed_data:
        action.validate_data(data)


def test_valid_automated_translation_data_passes_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'es'}]

    action = AutomaticGoogleTranscriptionAction(xpath, params)

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
        {'language': 'es', 'status': 'failed', 'error': 'Translation failed'},
        {
            'language': 'es',
            'locale': 'fr-CA',
            'status': 'failed',
            'error': 'Translation failed',
        },
    ]

    for data in allowed_data:
        action.validate_automated_data(data)


def test_invalid_user_data_fails_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'es'}]
    action = AutomaticGoogleTranscriptionAction(xpath, params)

    invalid_data = [
        # Wrong language
        {'language': 'en'},
        # Empty data
        {},
        # Cannot push a translation
        {'language': 'fr', 'value': 'Aucune idée'},
        # Cannot push a translation
        {'language': 'fr', 'value': 'Aucune idée', 'status': 'complete'},
        # Cannot push a translation
        {'language': 'fr', 'value': 'Aucune idée', 'status': 'in_progress'},
        # Cannot push a translation
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
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = AutomaticGoogleTranscriptionAction(xpath, params)

    invalid_data = [
        # Wrong language
        {'language': 'es', 'value': 'No idea', 'status': 'complete'},
        # Cannot pass a value while in progress
        {'language': 'en', 'value': 'No idea', 'status': 'in_progress'},
        {},
        # Cannot accept an empty translation
        {'language': 'en', 'accepted': True},
        # Cannot deny an empty translation
        {'language': 'en', 'accepted': False},
        # Cannot pass value and accepted at the same time
        {'language': 'en', 'value': None, 'accepted': False},
        # Cannot have a value while in progress
        {'language': 'en', 'value': 'No idea', 'status': 'in_progress'},
        # Missing error property
        {'language': 'en', 'status': 'failed'},
        # Delete transcript without status
        {'language': 'fr', 'value': None},
        # Delete transcript with locale without status
        {'language': 'fr', 'locale': 'fr-CA', 'value': None},
        # failed with no status
        {'language': 'es', 'error': 'Translation failed'},
        # failed with no error
        {'language': 'es', 'status': 'failed'},
    ]

    for data in invalid_data:
        with pytest.raises(jsonschema.exceptions.ValidationError):
            action.validate_automated_data(data)


def test_valid_result_passes_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = AutomaticGoogleTranscriptionAction(xpath, params)

    first = {'language': 'fr', 'value': 'un'}
    second = {'language': 'en', 'value': 'two'}
    third = {'language': 'fr', 'value': 'trois'}
    fourth = {'language': 'fr', 'accepted': True}
    fifth = {'language': 'fr', 'value': None}
    six = {'language': 'en', 'value': 'six'}
    mock_sup_det = action.action_class_config.default_type

    mock_service = MagicMock()
    with patch(
        'kobo.apps.subsequences.actions.automatic_google_transcription.GoogleTranscriptionService',  # noqa
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
            mock_sup_det = action.revise_data(EMPTY_SUBMISSION, EMPTY_SUPPLEMENT,mock_sup_det, data)

        action.validate_result(mock_sup_det)

    assert '_dateAccepted' in mock_sup_det['_revisions'][1]
    assert mock_sup_det['_revisions'][0]['status'] == 'deleted'


def test_acceptance_does_not_produce_revisions():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = AutomaticGoogleTranscriptionAction(xpath, params)

    first = {'language': 'fr', 'value': 'un'}
    second = {'language': 'fr', 'accepted': True}
    third = {'language': 'fr', 'accepted': False}
    mock_sup_det = action.action_class_config.default_type

    mock_service = MagicMock()
    with patch(
        'kobo.apps.subsequences.actions.automatic_google_transcription.GoogleTranscriptionService',  # noqa
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
            mock_sup_det = action.revise_data(EMPTY_SUBMISSION, EMPTY_SUPPLEMENT,mock_sup_det, data)
            assert '_revisions' not in mock_sup_det
            if data.get('value') is None:
                is_date_accepted_present = mock_sup_det.get('_dateAccepted') is None
                assert is_date_accepted_present is not bool(data.get('accepted'))

        action.validate_result(mock_sup_det)


def test_invalid_result_fails_validation():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = AutomaticGoogleTranscriptionAction(xpath, params)

    first = {'language': 'fr', 'value': 'un'}
    second = {'language': 'en', 'value': 'two'}
    third = {'language': 'fr', 'value': 'trois'}
    fourth = {'language': 'fr', 'accepted': True}
    fifth = {'language': 'fr', 'value': None}
    six = {'language': 'en', 'value': 'six'}
    mock_sup_det = action.action_class_config.default_type

    mock_service = MagicMock()
    with patch(
        'kobo.apps.subsequences.actions.automatic_google_transcription.GoogleTranscriptionService',
        # noqa
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
            mock_sup_det = action.revise_data(EMPTY_SUBMISSION, EMPTY_SUPPLEMENT,mock_sup_det, data)

        action.validate_result(mock_sup_det)

    # erroneously add '_dateModified' onto a revision
    first_revision = mock_sup_det['_revisions'][0]
    first_revision['_dateModified'] = first_revision['_dateCreated']

    with pytest.raises(jsonschema.exceptions.ValidationError):
        action.validate_result(mock_sup_det)


def test_transcription_revisions_are_retained_in_supplemental_details():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = AutomaticGoogleTranscriptionAction(xpath, params)

    first = {'language': 'en', 'value': 'No idea'}
    second = {'language': 'fr', 'value': 'Aucune idée'}
    mock_service = MagicMock()
    with patch(
        'kobo.apps.subsequences.actions.automatic_google_transcription.GoogleTranscriptionService',
        # noqa
        return_value=mock_service,
    ):
        value = first.pop('value', None)
        mock_service.process_data.return_value = {'value': value, 'status': 'complete'}
        mock_sup_det = action.revise_data(
            EMPTY_SUBMISSION, EMPTY_SUPPLEMENT, action.action_class_config.default_type, first
        )

    assert mock_sup_det['language'] == 'en'
    assert mock_sup_det['value'] == 'No idea'
    assert mock_sup_det['_dateCreated'] == mock_sup_det['_dateModified']
    assert '_revisions' not in mock_sup_det
    first_time = mock_sup_det['_dateCreated']

    with patch(
        'kobo.apps.subsequences.actions.automatic_google_transcription.GoogleTranscriptionService',  # noqa
        return_value=mock_service,
    ):
        value = second.pop('value', None)
        mock_service.process_data.return_value = {'value': value, 'status': 'complete'}
        mock_sup_det = action.revise_data(EMPTY_SUBMISSION, EMPTY_SUPPLEMENT,mock_sup_det, second)

    assert len(mock_sup_det['_revisions']) == 1

    # the revision should encompass the first transcript
    assert mock_sup_det['_revisions'][0].items() >= first.items()

    # the revision should have a creation timestamp equal to that of the first
    # transcript
    assert mock_sup_det['_revisions'][0]['_dateCreated'] == first_time

    # revisions should not list a modification timestamp
    assert '_dateModified' not in mock_sup_det['_revisions'][0]

    # the record itself (not revision) should have an unchanged creation
    # timestamp
    assert mock_sup_det['_dateCreated'] == first_time

    # the record itself should have an updated modification timestamp
    assert dateutil.parser.parse(mock_sup_det['_dateModified']) > dateutil.parser.parse(
        mock_sup_det['_dateCreated']
    )

    # the record itself should encompass the second transcript
    assert mock_sup_det.items() >= second.items()


def test_latest_revision_is_first():
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'en'}]
    action = AutomaticGoogleTranscriptionAction(xpath, params)

    first = {'language': 'fr', 'value': 'un'}
    second = {'language': 'fr', 'value': 'deux'}
    third = {'language': 'fr', 'value': 'trois'}

    mock_sup_det = action.action_class_config.default_type
    mock_service = MagicMock()
    with patch(
        'kobo.apps.subsequences.actions.automatic_google_transcription.GoogleTranscriptionService',
        # noqa
        return_value=mock_service,
    ):
        for data in first, second, third:
            value = data.pop('value')
            mock_service.process_data.return_value = {
                'value': value,
                'status': 'complete',
            }
            mock_sup_det = action.revise_data(EMPTY_SUBMISSION, EMPTY_SUPPLEMENT,mock_sup_det, data)

    assert mock_sup_det['value'] == 'trois'
    assert mock_sup_det['_revisions'][0]['value'] == 'deux'
    assert mock_sup_det['_revisions'][1]['value'] == 'un'
