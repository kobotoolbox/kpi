from copy import deepcopy
from unittest.mock import MagicMock, patch

import dateutil
import jsonschema
import pytest

from ..actions.automatic_google_translation import AutomaticGoogleTranslationAction
from ..exceptions import TranscriptionNotFound
from .constants import EMPTY_SUBMISSION, EMPTY_SUPPLEMENT, QUESTION_SUPPLEMENT


def test_valid_params_pass_validation():
    params = [{'language': 'fr'}, {'language': 'es'}]
    AutomaticGoogleTranslationAction.validate_params(params)


def test_invalid_params_fail_validation():
    params = [{'language': 123}, {'language': 'es'}]
    with pytest.raises(jsonschema.exceptions.ValidationError):
        AutomaticGoogleTranslationAction.validate_params(params)


def test_valid_user_data_passes_validation():
    action = _get_action()

    allowed_data = [
        # Trivial case
        {'language': 'fr'},
        # Transcription with locale
        {'language': 'fr', 'locale': 'fr-CA'},
        # Delete translation
        {'language': 'fr', 'value': None},
        # Delete translation with locale
        {'language': 'fr', 'locale': 'fr-CA', 'value': None},
        # Accept translation
        {'language': 'fr', 'accepted': True},
        # Accept translation with locale
        {'language': 'fr', 'locale': 'fr-CA', 'accepted': True},
    ]

    for data in allowed_data:
        action.validate_data(data)


def test_valid_automatic_translation_data_passes_validation():
    action = _get_action()

    allowed_data = [
        # Trivial case
        {'language': 'fr', 'value': 'Aucune idée', 'status': 'complete'},
        {
            'language': 'fr',
            'locale': 'fr-FR',
            'value': 'Aucune idée',
            'status': 'complete',
        },
        # Delete translation
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
        action.validate_external_data(data)


def test_invalid_user_data_fails_validation():
    action = _get_action()

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
        {'language': 'fr', 'value': None, 'accepted': True},
        # Cannot un-accept a translation
        {'language': 'fr', 'accepted': False},
    ]

    for data in invalid_data:
        with pytest.raises(jsonschema.exceptions.ValidationError):
            action.validate_data(data)


def test_invalid_automatic_data_fails_validation():
    action = _get_action()

    invalid_data = [
        # Wrong language
        {'language': 'en', 'value': 'No idea', 'status': 'complete'},
        # Cannot pass a value while in progress
        {'language': 'es', 'value': 'Ni idea', 'status': 'in_progress'},
        # Cannot pass an empty object
        {},
        # Cannot accept an empty translation
        {'language': 'es', 'accepted': True},
        # Cannot pass value and accepted at the same time
        {'language': 'es', 'value': None, 'accepted': True},
        # Cannot have a value while in progress
        {'language': 'es', 'value': 'Ni idea', 'status': 'in_progress'},
        # Missing error property
        {'language': 'es', 'status': 'failed'},
        # Delete translation without status
        {'language': 'fr', 'value': None},
        # Delete translation with locale without status
        {'language': 'fr', 'locale': 'fr-CA', 'value': None},
        # failed with no status
        {'language': 'es', 'error': 'Translation failed'},
        # failed with no error
        {'language': 'es', 'status': 'failed'},
    ]

    for data in invalid_data:
        with pytest.raises(jsonschema.exceptions.ValidationError):
            action.validate_external_data(data)


def test_valid_result_passes_validation():
    action = _get_action()

    first = {'language': 'fr', 'value': 'un'}
    second = {'language': 'es', 'value': 'dos'}
    third = {'language': 'fr', 'value': 'trois'}
    fourth = {'language': 'fr', 'accepted': True}
    fifth = {'language': 'fr', 'value': None}
    six = {'language': 'es', 'value': 'seis'}
    mock_sup_det = EMPTY_SUPPLEMENT

    mock_service = MagicMock()
    with patch(
        'kobo.apps.subsequences.actions.automatic_google_translation.GoogleTranslationService',  # noqa
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

    assert '_dateAccepted' in mock_sup_det['fr']['_versions'][1]
    assert mock_sup_det['fr']['_versions'][0]['_data']['status'] == 'deleted'
    assert mock_sup_det['es']['_versions'][1]['_data']['status'] == 'complete'
    assert mock_sup_det['fr']['_versions'][-1]['_data']['status'] == 'complete'


def test_acceptance_does_not_produce_versions():
    action = _get_action()

    first = {'language': 'fr', 'value': 'un'}
    second = {'language': 'fr', 'accepted': True}
    mock_sup_det = EMPTY_SUPPLEMENT

    mock_service = MagicMock()
    with patch(
        'kobo.apps.subsequences.actions.automatic_google_translation.GoogleTranslationService',  # noqa
        return_value=mock_service,
    ):
        for data in first, second:
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
            if data.get('value') is None:
                is_date_accepted_present = (
                    mock_sup_det['fr']['_versions'][0].get('_dateAccepted') is None
                )
                assert is_date_accepted_present is not bool(data.get('accepted'))

        action.validate_result(mock_sup_det)


def test_invalid_result_fails_validation():
    action = _get_action()

    first = {'language': 'fr', 'value': 'un'}
    second = {'language': 'es', 'value': 'dos'}
    third = {'language': 'fr', 'value': 'trois'}
    fourth = {'language': 'fr', 'accepted': True}
    fifth = {'language': 'fr', 'value': None}
    six = {'language': 'es', 'value': 'seis'}
    mock_sup_det = EMPTY_SUPPLEMENT

    mock_service = MagicMock()
    with patch(
        'kobo.apps.subsequences.actions.automatic_google_translation.GoogleTranslationService',  # noqa
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
    first_version = mock_sup_det['fr']['_versions'][0]
    first_version['_dateModified'] = first_version['_dateCreated']

    with pytest.raises(jsonschema.exceptions.ValidationError):
        action.validate_result(mock_sup_det)


def test_translation_versions_are_retained_in_supplemental_details():
    action = _get_action()

    first = {'language': 'es', 'value': 'Ni idea'}
    second = {'language': 'fr', 'value': 'Aucune idée'}
    third = {'language': 'es', 'value': 'Ninguna idea'}

    mock_service = MagicMock()
    with patch(
        'kobo.apps.subsequences.actions.automatic_google_translation.GoogleTranslationService',  # noqa
        return_value=mock_service,
    ):
        value = first.pop('value', None)
        mock_service.process_data.return_value = {'value': value, 'status': 'complete'}
        mock_sup_det = action.revise_data(EMPTY_SUBMISSION, EMPTY_SUPPLEMENT, first)

    assert mock_sup_det['es']['_versions'][0]['_data']['language'] == 'es'
    assert mock_sup_det['es']['_versions'][0]['_data']['value'] == 'Ni idea'
    assert mock_sup_det['es']['_dateCreated'] == mock_sup_det['es']['_dateModified']
    first_time = mock_sup_det['es']['_versions'][0]['_dateCreated']

    with patch(
        'kobo.apps.subsequences.actions.automatic_google_translation.GoogleTranslationService',  # noqa
        return_value=mock_service,
    ):
        value = second.pop('value', None)
        mock_service.process_data.return_value = {'value': value, 'status': 'complete'}
        mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, second)

    assert len(mock_sup_det.keys()) == 2

    assert mock_sup_det['fr']['_versions'][0]['_data']['language'] == 'fr'
    assert mock_sup_det['fr']['_versions'][0]['_data']['value'] == 'Aucune idée'
    assert mock_sup_det['fr']['_dateCreated'] == mock_sup_det['fr']['_dateModified']

    with patch(
        'kobo.apps.subsequences.actions.automatic_google_translation.GoogleTranslationService',  # noqa
        return_value=mock_service,
    ):
        value = third.pop('value', None)
        mock_service.process_data.return_value = {'value': value, 'status': 'complete'}
        mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, third)

    assert len(mock_sup_det.keys()) == 2

    # the first version should have a creation timestamp equal to that of the first
    # translation
    assert mock_sup_det['es']['_versions'][-1]['_dateCreated'] == first_time

    # versions should not list a modification timestamp
    assert '_dateModified' not in mock_sup_det['es']['_versions'][0]

    # the record itself (not version) should have an unchanged creation
    # timestamp
    assert mock_sup_det['es']['_dateCreated'] == first_time

    # the record itself should have an updated modification timestamp
    assert dateutil.parser.parse(
        mock_sup_det['es']['_dateModified']
    ) > dateutil.parser.parse(mock_sup_det['es']['_dateCreated'])


def test_latest_version_is_first():
    action = _get_action()

    first = {'language': 'fr', 'value': 'un'}
    second = {'language': 'fr', 'value': 'deux'}
    third = {'language': 'fr', 'value': 'trois'}

    mock_sup_det = EMPTY_SUPPLEMENT
    mock_service = MagicMock()
    with patch(
        'kobo.apps.subsequences.actions.automatic_google_translation.GoogleTranslationService',  # noqa
        return_value=mock_service,
    ):
        for data in first, second, third:
            value = data.pop('value')
            mock_service.process_data.return_value = {
                'value': value,
                'status': 'complete',
            }
            mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, data)

    assert mock_sup_det['fr']['_versions'][0]['_data']['value'] == 'trois'
    assert mock_sup_det['fr']['_versions'][1]['_data']['value'] == 'deux'
    assert mock_sup_det['fr']['_versions'][2]['_data']['value'] == 'un'


def test_cannot_revise_data_without_transcription():
    action = _get_action(fetch_action_dependencies=False)

    mock_service = MagicMock()
    with patch(
        'kobo.apps.subsequences.actions.automatic_google_translation.GoogleTranslationService',  # noqa
        return_value=mock_service,
    ):
        mock_service.process_data.return_value = {
            'value': 'fr',
            'status': 'complete',
        }

        with pytest.raises(TranscriptionNotFound):
            action.revise_data(EMPTY_SUBMISSION, EMPTY_SUPPLEMENT, {'language': 'fr'})


def test_find_the_most_recent_accepted_transcription():
    action = _get_action()

    # Automatic transcription is the most recent
    action_data = {}
    expected = {
        '_dependency': {
            'value': 'My audio has been transcribed automatically',
            'language': 'en',
            '_uuid': '4dcf9c9f-e503-4e5c-81f5-74250b295001',
            '_actionId': 'automatic_google_transcription',
        }
    }
    action_data = action.attach_action_dependency(action_data)
    assert action_data == expected

    # Manual transcription is the most recent
    question_supplement_data = deepcopy(QUESTION_SUPPLEMENT)
    question_supplement_data['manual_transcription']['_versions'][0][
        '_dateAccepted'
    ] = '2025-07-28T16:18:00Z'
    action.get_action_dependencies(question_supplement_data)

    action_data = {}  # not really relevant for this test
    expected = {
        '_dependency': {
            'value': 'My audio has been transcribed manually',
            'language': 'en-CA',
            '_uuid': 'd69b9263-04fd-45b4-b011-2e166cfefd4a',
            '_actionId': 'manual_transcription',
        }
    }

    action_data = action.attach_action_dependency(action_data)
    assert action_data == expected


def test_transform_data_for_output():
    action = _get_action()
    first = {'language': 'es', 'value': 'Hola'}
    second = {'language': 'es', 'value': 'Hola otra vez'}
    third = {'language': 'fr', 'value': 'bonjour'}
    mock_sup_det = EMPTY_SUPPLEMENT
    mock_service = MagicMock()
    with patch(
        'kobo.apps.subsequences.actions.automatic_google_translation.GoogleTranslationService',  # noqa
        return_value=mock_service,
    ):
        for data in first, second, third:
            value = data.pop('value')
            mock_service.process_data.return_value = {
                'value': value,
                'status': 'complete',
            }
            mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, data)

    retrieved_data = action.retrieve_data(mock_sup_det)
    result = action.transform_data_for_output(retrieved_data)
    assert result == {
        ('translation', 'es'): {
            'value': 'Hola otra vez',
            'languageCode': 'es',
            '_sortByDate': None,
        },
        ('translation', 'fr'): {
            'value': 'bonjour',
            'languageCode': 'fr',
            '_sortByDate': None,
        },
    }


def test_transform_data_for_output_with_delete():
    action = _get_action()
    first = {'language': 'es', 'value': 'Hola'}
    second = {'language': 'es', 'value': 'Hola otra vez'}
    third = {'language': 'fr', 'value': 'bonjour'}
    fourth = {'language': 'es', 'value': None}
    mock_sup_det = EMPTY_SUPPLEMENT
    mock_service = MagicMock()
    with patch(
        'kobo.apps.subsequences.actions.automatic_google_translation.GoogleTranslationService',  # noqa
        return_value=mock_service,
    ):
        for data in first, second, third, fourth:
            value = data.pop('value')
            mock_service.process_data.return_value = {
                'value': value,
                'status': 'complete' if value is not None else 'deleted',
            }
            # Reinject value to similate the deletion.
            if value is None:
                data['value'] = None

            mock_sup_det = action.revise_data(EMPTY_SUBMISSION, mock_sup_det, data)

    retrieved_data = action.retrieve_data(mock_sup_det)
    result = action.transform_data_for_output(retrieved_data)
    assert result == {
        ('translation', 'es'): {
            'value': None,
            'languageCode': 'es',
            '_sortByDate': retrieved_data['es']['_versions'][0]['_dateCreated'],
        },
        ('translation', 'fr'): {
            'value': 'bonjour',
            'languageCode': 'fr',
            '_sortByDate': None,
        },
    }


def _get_action(fetch_action_dependencies=True):
    xpath = 'group_name/question_name'  # irrelevant for this test
    params = [{'language': 'fr'}, {'language': 'es'}]
    mock_asset = MagicMock()
    mock_asset.pk = 1
    mock_asset.owner.pk = 1
    action = AutomaticGoogleTranslationAction(xpath, params, asset=mock_asset)
    if fetch_action_dependencies:
        action.get_action_dependencies(QUESTION_SUPPLEMENT)
    return action
