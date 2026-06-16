import json
from unittest.mock import MagicMock, patch

import pytest
from google.api_core.exceptions import PermissionDenied

from kobo.apps.subsequences.exceptions import (
    GoogleTranscriptionServiceNotConfigured,
    TranscriptionResultNotFound,
)
from kobo.apps.subsequences.integrations.google.google_transcribe import (
    GoogleTranscriptionService,
)
from kobo.apps.subsequences.integrations.google.rate_limit import (
    GoogleServiceRateLimitExceeded,
)


class MockBlob:
    def __init__(self, name, content='{}'):
        self.name = name
        self.content = content

    def download_as_text(self):
        return self.content


def _get_service_with_blobs(blobs):
    service = object.__new__(GoogleTranscriptionService)
    service.bucket = MagicMock()
    service.bucket.list_blobs.return_value = blobs
    service._get_batch_paths = MagicMock(return_value=('input.flac', 'output'))
    return service


def _get_service_for_process_data():
    service = object.__new__(GoogleTranscriptionService)
    service.submission_root_uuid = 'submission-1'
    service.asset = MagicMock()
    service._clear_operation_reference = MagicMock()
    return service


def test_adapt_response_handles_nested_batch_result_payloads():
    service = object.__new__(GoogleTranscriptionService)
    response = {
        'response': {
            'results': [
                {'alternatives': [{'transcript': 'Hello'}]},
                {
                    'inline_result': {
                        'results': [
                            {'alternatives': [{'transcript': 'world'}]},
                        ]
                    }
                },
            ]
        }
    }

    assert service.adapt_response(response) == 'Hello world'


def test_read_batch_result_raises_when_no_json_result_files_exist():
    service = _get_service_with_blobs(
        [
            MockBlob('output/'),
            MockBlob('output/metadata.txt'),
        ]
    )

    with pytest.raises(TranscriptionResultNotFound) as exc_info:
        service._read_batch_result('audio', 'en-US')

    assert 'No transcription JSON result files were found' in str(exc_info.value)


def test_read_batch_result_returns_empty_transcript_for_silent_audio_result():
    service = _get_service_with_blobs(
        [
            MockBlob(
                'output/result.json',
                json.dumps(
                    {
                        'results': [
                            {
                                'alternatives': [
                                    {
                                        'transcript': '',
                                    }
                                ],
                            }
                        ]
                    }
                ),
            ),
        ]
    )

    assert service._read_batch_result('audio', 'en-US') == ''


def test_read_batch_result_joins_transcripts_from_json_result_files():
    service = _get_service_with_blobs(
        [
            MockBlob(
                'output/result-2.json',
                json.dumps({'results': [{'alternatives': [{'transcript': 'world'}]}]}),
            ),
            MockBlob(
                'output/result-1.json',
                json.dumps({'results': [{'alternatives': [{'transcript': 'Hello'}]}]}),
            ),
        ]
    )

    assert service._read_batch_result('audio', 'en-US') == 'Hello world'


def test_process_data_returns_failed_for_missing_google_service_config():
    service = _get_service_for_process_data()
    service._get_google_language_config = MagicMock(
        side_effect=GoogleTranscriptionServiceNotConfigured(
            'Google transcription service is not configured.'
        )
    )

    result = service.process_data('audio', {'language': 'en'})

    assert result == {
        'status': 'failed',
        'error': 'Google transcription service is not configured.',
    }


@patch(
    'kobo.apps.subsequences.integrations.google.google_transcribe.get_speech_location_for_model',  # noqa E501
    return_value=None,
)
def test_process_data_returns_failed_for_polling_auth_errors(_mock_location):
    service = _get_service_for_process_data()
    service._get_google_language_config = MagicMock(
        return_value=MagicMock(language_code='en-US', location_code='global')
    )
    service._get_operation_reference = MagicMock(return_value='operations/123')
    service._get_operation_payload = MagicMock(
        side_effect=PermissionDenied('permission denied')
    )

    result = service.process_data('audio', {'language': 'en'})

    assert result['status'] == 'failed'
    assert 'credentials or permissions are invalid' in result['error']
    service._clear_operation_reference.assert_called_once_with(
        'audio', 'en-US', None
    )


def test_process_data_raises_quota_error_when_start_quota_is_exhausted():
    """
    Test that if the internal token bucket rate limit is exhausted,
    the transcription process aborts locally and bubbles the quota error up
    to Celery for retrying, without making any external API calls to Google
    """
    service = _get_service_for_process_data()
    service._get_google_language_config = MagicMock(
        return_value=MagicMock(language_code='en-US', location_code='global')
    )
    service._get_operation_reference = MagicMock(return_value=None)
    service.get_converted_audio = MagicMock(return_value=(b'audio', MagicMock()))
    service.begin_google_operation = MagicMock(
        side_effect=GoogleServiceRateLimitExceeded(
            'speech_v2_batch_recognize',
            retry_after=1,
        )
    )

    with pytest.raises(GoogleServiceRateLimitExceeded):
        service.process_data('audio', {'language': 'en'})
    service._clear_operation_reference.assert_not_called()


@patch(
    'kobo.apps.subsequences.integrations.google.google_transcribe.get_speech_location_for_model',  # noqa E501
    return_value=None,
)
def test_process_data_returns_failed_for_unexpected_polling_errors(_mock_location):
    service = _get_service_for_process_data()
    service._get_google_language_config = MagicMock(
        return_value=MagicMock(language_code='en-US', location_code='global')
    )
    service._get_operation_reference = MagicMock(return_value='operations/123')
    service._get_operation_payload = MagicMock(
        side_effect=AttributeError('unexpected bug')
    )

    result = service.process_data('audio', {'language': 'en'})

    assert result == {
        'status': 'failed',
        'error': 'Transcription failed with error unexpected bug',
    }
    service._clear_operation_reference.assert_called_once_with(
        'audio', 'en-US', None
    )
