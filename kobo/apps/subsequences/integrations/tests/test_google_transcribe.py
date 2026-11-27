import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from django.test import override_settings
from google.api_core.exceptions import (
    DeadlineExceeded,
    Forbidden,
    InvalidArgument,
    NotFound,
    PermissionDenied,
    ResourceExhausted,
    RetryError,
    ServiceUnavailable,
    Unauthenticated,
)
from google.cloud import speech_v2 as speech
from google.rpc import status_pb2

from kobo.apps.organizations.constants import UsageType
from kobo.apps.subsequences.exceptions import (
    ChunkStorageError,
    ChunkStorageRefusedError,
    GoogleTranscriptionServiceNotConfigured,
    ServiceQuotaExceededError,
    TranscriptionResultNotFound,
)
from kobo.apps.subsequences.integrations.google.google_transcribe import (
    GoogleTranscriptionService,
    SpeechConfig,
)
from kobo.apps.subsequences.integrations.rate_limit import ServiceRateLimitExceeded
from kpi.exceptions import (
    AttachmentNotFoundException,
    InvalidXPathException,
    NotSupportedFormatException,
    SubmissionNotFoundException,
    UsageLimitExceededException,
    XPathNotFoundException,
)

# What `process_data()` is told about the run: the request that launches it,
# then the polls that check on it
LAUNCH = {'version_uuid': 'version-1', 'is_launch': True}
POLL = {'version_uuid': 'version-1', 'is_launch': False}

SERVICE_MODULE = 'kobo.apps.subsequences.integrations.google.google_transcribe'
HARD_LIMIT = GoogleTranscriptionService.CHUNK_HARD_LIMIT_SECONDS


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
    service._get_batch_paths = MagicMock(return_value=('input.flac', 'output'))
    service._clear_operation_reference = MagicMock()
    return service


@pytest.fixture(autouse=True)
def chunking():
    """
    A short recording whose run has no chunk rows, unless a test says
    otherwise. The rows live in the database, which these tests do not use
    """
    with patch(f'{SERVICE_MODULE}.ChunkedTranscriptionRun') as run_class, patch(
        f'{SERVICE_MODULE}.get_audio_duration', return_value=60.0
    ) as get_audio_duration:
        run_class.return_value.get_status.return_value = None
        yield SimpleNamespace(
            run_class=run_class,
            run=run_class.return_value,
            get_audio_duration=get_audio_duration,
        )


@pytest.fixture
def starting_service():
    """
    A service about to start a run: nothing is running for it yet, and the
    usage check and the whole-file start are recorded rather than run
    """
    with patch(
        f'{SERVICE_MODULE}.get_asr_language_code_overrides', return_value={}
    ), patch(f'{SERVICE_MODULE}.get_speech_location_for_model', return_value=None):
        service = _get_service_for_process_data()
        service._get_google_language_config = MagicMock(
            return_value=MagicMock(language_code='en-US', location_code='global')
        )
        service._get_operation_reference = MagicMock(return_value=None)
        service._get_attachment = MagicMock()
        service._before_new_operation = MagicMock()
        service._start_operation = MagicMock(
            return_value={'status': 'complete', 'value': 'Hello'}
        )
        yield service


@patch(
    'kobo.apps.subsequences.integrations.google.base.raise_if_usage_limit_exceeded',
    side_effect=UsageLimitExceededException,
)
@patch(
    'kobo.apps.subsequences.integrations.google.google_transcribe.get_asr_language_code_overrides',  # noqa E501
    return_value={},
)
@patch(
    'kobo.apps.subsequences.integrations.google.google_transcribe.get_speech_location_for_model',  # noqa E501
    return_value=None,
)
def test_process_data_checks_usage_limit_before_starting(
    _mock_location, _mock_overrides, mock_raise_if_exceeded
):
    service = _get_service_for_process_data()
    service._get_google_language_config = MagicMock(
        return_value=MagicMock(language_code='en-US', location_code='global')
    )
    service._get_operation_reference = MagicMock(return_value=None)
    service._get_attachment = MagicMock()
    service.get_converted_audio = MagicMock()

    with pytest.raises(UsageLimitExceededException):
        service.process_data('audio', {'language': 'en'}, **LAUNCH)
    mock_raise_if_exceeded.assert_called_once_with(
        service.asset.owner, UsageType.ASR_SECONDS
    )
    # Refused before the audio is converted or anything is sent to Google
    service.get_converted_audio.assert_not_called()


@patch(
    'kobo.apps.subsequences.integrations.google.base.raise_if_usage_limit_exceeded',
    side_effect=UsageLimitExceededException,
)
@patch(
    'kobo.apps.subsequences.integrations.google.google_transcribe.get_asr_language_code_overrides',  # noqa E501
    return_value={},
)
@patch(
    'kobo.apps.subsequences.integrations.google.google_transcribe.get_speech_location_for_model',  # noqa E501
    return_value=None,
)
def test_process_data_skips_usage_limit_check_when_resuming(
    _mock_location, _mock_overrides, mock_raise_if_exceeded
):
    service = _get_service_for_process_data()
    service._get_google_language_config = MagicMock(
        return_value=MagicMock(language_code='en-US', location_code='global')
    )
    service._get_operation_reference = MagicMock(return_value='operations/1')
    service._get_operation_payload = MagicMock(return_value={'done': False})

    result = service.process_data('audio', {'language': 'en'}, **POLL)

    assert result == {'status': 'in_progress'}
    mock_raise_if_exceeded.assert_not_called()


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


def test_extract_per_file_error_returns_none_for_empty_response():
    service = object.__new__(GoogleTranscriptionService)

    assert service._extract_per_file_error(None) is None
    assert service._extract_per_file_error({}) is None


def test_extract_per_file_error_returns_none_when_no_result_has_an_error():
    service = object.__new__(GoogleTranscriptionService)
    response = {'results': {'gs://bucket/file.flac': {}}}

    assert service._extract_per_file_error(response) is None


def test_extract_per_file_error_reads_message_from_dict_response():
    service = object.__new__(GoogleTranscriptionService)
    response = {
        'results': {
            'gs://bucket/file.flac': {'error': {'message': 'some google error'}},
        }
    }

    assert service._extract_per_file_error(response) == 'some google error'


def test_extract_per_file_error_reads_message_from_proto_response():
    """
    Exercise the real proto path returned by `operation.result()`, as opposed
    to the dict path from the polling code (already covered by
    `test_extract_per_file_error_reads_message_from_dict_response`).
    `BatchRecognizeFileResult.error` is a generated protobuf field typed
    `google.rpc.Status`, so it must be built from that message type rather
    than a plain string or dict.
    """

    service = object.__new__(GoogleTranscriptionService)
    response = speech.BatchRecognizeResponse(
        results={
            'gs://bucket/file.flac': speech.BatchRecognizeFileResult(
                error=status_pb2.Status(message='some google error'),
            ),
        }
    )

    assert service._extract_per_file_error(response) == 'some google error'


def test_read_batch_result_raises_when_no_json_result_files_exist():
    service = _get_service_with_blobs(
        [
            MockBlob('output/'),
            MockBlob('output/metadata.txt'),
        ]
    )

    with pytest.raises(TranscriptionResultNotFound) as exc_info:
        service._read_batch_result('output')

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

    assert service._read_batch_result('output') == ''


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

    assert service._read_batch_result('output') == 'Hello world'
    # Within the job's folder only
    service.bucket.list_blobs.assert_called_once_with(prefix='output/')


def test_process_data_returns_failed_for_missing_google_service_config():
    service = _get_service_for_process_data()
    service._get_google_language_config = MagicMock(
        side_effect=GoogleTranscriptionServiceNotConfigured(
            'Google transcription service is not configured.'
        )
    )

    result = service.process_data('audio', {'language': 'en'}, **LAUNCH)

    assert result == {
        'status': 'failed',
        'error': 'Google transcription service is not configured.',
    }


@patch(
    'kobo.apps.subsequences.integrations.google.google_transcribe.get_asr_language_code_overrides',  # noqa E501
    return_value={},
)
@patch(
    'kobo.apps.subsequences.integrations.google.google_transcribe.get_speech_location_for_model',  # noqa E501
    return_value=None,
)
def test_process_data_returns_failed_for_polling_auth_errors(
    _mock_location, _mock_overrides
):
    service = _get_service_for_process_data()
    service._get_google_language_config = MagicMock(
        return_value=MagicMock(language_code='en-US', location_code='global')
    )
    service._get_operation_reference = MagicMock(return_value='operations/123')
    service._get_operation_payload = MagicMock(
        side_effect=PermissionDenied('permission denied')
    )

    result = service.process_data('audio', {'language': 'en'}, **POLL)

    assert result['status'] == 'failed'
    assert 'credentials or permissions are invalid' in result['error']
    service._clear_operation_reference.assert_called_once_with(
        'audio', 'en-US', None
    )


@patch(
    'kobo.apps.subsequences.integrations.google.base.raise_if_usage_limit_exceeded',
)
@patch(
    'kobo.apps.subsequences.integrations.google.google_transcribe.get_asr_language_code_overrides',  # noqa E501
    return_value={},
)
@patch(
    'kobo.apps.subsequences.integrations.google.google_transcribe.get_speech_location_for_model',  # noqa E501
    return_value=None,
)
def test_process_data_raises_quota_error_when_start_quota_is_exhausted(
    _mock_location, _mock_overrides, _mock_raise_if_exceeded
):
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
    service._get_attachment = MagicMock()
    service.get_converted_audio = MagicMock(return_value=(b'audio', MagicMock()))
    service.begin_google_operation = MagicMock(
        side_effect=ServiceRateLimitExceeded(
            'speech_v2_batch_recognize',
            retry_after=1,
        )
    )

    with pytest.raises(ServiceRateLimitExceeded):
        service.process_data('audio', {'language': 'en'}, **LAUNCH)
    service._clear_operation_reference.assert_not_called()
    # The attachment is fetched once and handed to the conversion as is
    service._get_attachment.assert_called_once_with('audio')
    service.get_converted_audio.assert_called_once_with(
        service._get_attachment.return_value
    )


@pytest.mark.parametrize(
    'failing_step, error, expected_error',
    [
        ('_get_attachment', SubmissionNotFoundException, 'Submission not found'),
        ('_get_attachment', AttachmentNotFoundException, 'Attachment not found'),
        ('_get_attachment', InvalidXPathException, 'Invalid question name XPath'),
        ('_get_attachment', XPathNotFoundException, 'Invalid question name XPath'),
    ],
)
@patch(
    'kobo.apps.subsequences.integrations.google.base.raise_if_usage_limit_exceeded',
)
@patch(
    'kobo.apps.subsequences.integrations.google.google_transcribe.get_asr_language_code_overrides',  # noqa E501
    return_value={},
)
@patch(
    'kobo.apps.subsequences.integrations.google.google_transcribe.get_speech_location_for_model',  # noqa E501
    return_value=None,
)
def test_process_data_returns_failed_when_the_audio_cannot_be_read(
    _mock_location,
    _mock_overrides,
    _mock_raise_if_exceeded,
    failing_step,
    error,
    expected_error,
):
    service = _get_service_for_process_data()
    service._get_google_language_config = MagicMock(
        return_value=MagicMock(language_code='en-US', location_code='global')
    )
    service._get_operation_reference = MagicMock(return_value=None)
    service._get_attachment = MagicMock()
    service.get_converted_audio = MagicMock(return_value=(b'audio', MagicMock()))
    service.begin_google_operation = MagicMock()
    setattr(service, failing_step, MagicMock(side_effect=error))

    result = service.process_data('audio', {'language': 'en'}, **LAUNCH)

    assert result == {'status': 'failed', 'error': expected_error}
    # Nothing is sent to Google
    service.begin_google_operation.assert_not_called()


@patch(
    'kobo.apps.subsequences.integrations.google.google_transcribe.get_asr_language_code_overrides',  # noqa E501
    return_value={},
)
@patch(
    'kobo.apps.subsequences.integrations.google.google_transcribe.get_speech_location_for_model',  # noqa E501
    return_value=None,
)
def test_process_data_returns_failed_for_unexpected_polling_errors(
    _mock_location, _mock_overrides
):
    service = _get_service_for_process_data()
    service._get_google_language_config = MagicMock(
        return_value=MagicMock(language_code='en-US', location_code='global')
    )
    service._get_operation_reference = MagicMock(return_value='operations/123')
    service._get_operation_payload = MagicMock(
        side_effect=AttributeError('unexpected bug')
    )

    result = service.process_data('audio', {'language': 'en'}, **POLL)

    assert result == {
        'status': 'failed',
        'error': 'Transcription failed with error unexpected bug',
    }
    service._clear_operation_reference.assert_called_once_with(
        'audio', 'en-US', None
    )


def test_polling_a_finished_job_reads_its_transcript_and_forgets_the_job():
    service = _get_service_for_process_data()
    service._get_operation_payload = MagicMock(return_value={'done': True})
    service._read_batch_result = MagicMock(return_value='Hello')

    result = service._poll_operation(
        'audio', 'operations/1', SpeechConfig('en-US', 'chirp_3', 'eu'), None
    )

    assert result == {'status': 'complete', 'value': 'Hello'}
    service._get_operation_payload.assert_called_once_with('operations/1', 'eu')
    service._read_batch_result.assert_called_once_with('output')
    service._clear_operation_reference.assert_called_once_with('audio', 'en-US', None)


@pytest.mark.parametrize(
    'error, retryable',
    [
        (PermissionDenied('permission denied'), False),
        (Unauthenticated('invalid credentials'), False),
        (AttributeError('unexpected bug'), True),
    ],
)
def test_only_refused_credentials_make_a_failed_job_not_worth_starting_again(
    error, retryable
):
    service = _get_service_for_process_data()
    service._get_operation_payload = MagicMock(side_effect=error)

    report = service._check_batch_operation('operations/1', 'eu', 'output')

    assert report.status == 'failed'
    assert report.retryable is retryable


@pytest.mark.parametrize('duration', [60.0, HARD_LIMIT, None])
@pytest.mark.parametrize('run', [LAUNCH, POLL])
def test_a_recording_up_to_the_hard_limit_goes_to_google_whole(
    starting_service, chunking, run, duration
):
    """
    Nothing changes for a recording up to the limit, or one whose length is
    unknown: same usage check, same whole-file job
    """
    chunking.get_audio_duration.return_value = duration

    result = starting_service.process_data('audio', {'language': 'en'}, **run)

    assert result == {'status': 'complete', 'value': 'Hello'}
    starting_service._before_new_operation.assert_called_once_with()
    starting_service._start_operation.assert_called_once()
    chunking.run.start.assert_not_called()


@pytest.mark.parametrize('run, usage_checked', [(LAUNCH, True), (POLL, False)])
def test_a_recording_over_the_hard_limit_is_chunked(
    starting_service, chunking, run, usage_checked
):
    """
    The usage limit is checked when a chunked run is launched, not again in
    the poll that prepares it
    """
    chunking.get_audio_duration.return_value = HARD_LIMIT + 1
    chunking.run.start.return_value = {'status': 'in_progress'}

    result = starting_service.process_data('audio', {'language': 'en'}, **run)

    assert result == {'status': 'in_progress'}
    chunking.run_class.assert_called_once_with(
        starting_service.asset, 'submission-1', 'audio', 'version-1'
    )
    chunking.run.start.assert_called_once_with(
        starting_service,
        starting_service._get_attachment.return_value,
        is_launch=run['is_launch'],
    )
    starting_service._start_operation.assert_not_called()
    assert starting_service._before_new_operation.called is usage_checked


def test_a_run_with_chunk_rows_reports_on_them(starting_service, chunking):
    """
    Once its chunks are prepared, a poll neither fetches the attachment nor
    prepares them again
    """
    chunking.run.get_status.return_value = {'status': 'in_progress'}

    result = starting_service.process_data('audio', {'language': 'en'}, **POLL)

    assert result == {'status': 'in_progress'}
    # Moved forward with the run's speech settings
    chunking.run.get_status.assert_called_once_with(
        starting_service,
        SpeechConfig(
            language_code='en-US',
            model=starting_service._get_google_language_config.return_value.model_code,
            location='global',
        ),
    )
    starting_service._get_attachment.assert_not_called()
    starting_service._before_new_operation.assert_not_called()
    chunking.run.start.assert_not_called()
    starting_service._start_operation.assert_not_called()


def test_polling_a_whole_file_job_does_not_look_for_chunks(starting_service, chunking):
    """
    Short files are nearly all the traffic: polling one costs no chunk query
    """
    starting_service._get_operation_reference.return_value = 'operations/1'
    starting_service._poll_operation = MagicMock(return_value={'status': 'in_progress'})

    starting_service.process_data('audio', {'language': 'en'}, **POLL)

    chunking.run_class.assert_not_called()
    starting_service._get_attachment.assert_not_called()


def test_a_cancelled_bulk_item_sends_nothing_more(starting_service, chunking):
    """
    Whether its chunks are prepared or not: the run is cancelled, without
    starting anything
    """
    starting_service._get_bulk_action_item = MagicMock(
        return_value=SimpleNamespace(status='cancelled')
    )

    result = starting_service.process_data(
        'audio', {'language': 'en'}, bulk_action_uid='bulk-1', **POLL
    )

    assert result == {'status': 'failed', 'error': 'Transcription cancelled'}
    starting_service._get_bulk_action_item.assert_called_once_with('bulk-1')
    chunking.run.cancel.assert_called_once()
    # Asked for its engine, it is this service
    assert chunking.run.cancel.call_args.args[0]() is starting_service
    chunking.run.get_status.assert_not_called()
    chunking.run.start.assert_not_called()
    starting_service._get_attachment.assert_not_called()
    starting_service._start_operation.assert_not_called()


def test_a_whole_file_job_finished_before_the_cancel_still_saves_its_transcript(
    starting_service, chunking
):
    """
    It is charged once started
    """
    starting_service._get_bulk_action_item = MagicMock(
        return_value=SimpleNamespace(status='cancelled')
    )
    starting_service._get_operation_reference.return_value = 'operations/1'
    starting_service._poll_operation = MagicMock(
        return_value={'status': 'complete', 'value': 'Hello'}
    )

    result = starting_service.process_data(
        'audio', {'language': 'en'}, bulk_action_uid='bulk-1', **POLL
    )

    assert result == {'status': 'complete', 'value': 'Hello'}
    chunking.run.cancel.assert_not_called()


@pytest.mark.parametrize('run', [LAUNCH, POLL])
def test_a_file_that_is_not_audio_is_refused_before_anything_reads_it(
    starting_service, chunking, run
):
    """
    Refused for both paths at once: no duration probe, no usage check, no
    conversion
    """
    attachment = starting_service._get_attachment.return_value
    attachment.validate_transcodable.side_effect = NotSupportedFormatException

    result = starting_service.process_data('audio', {'language': 'en'}, **run)

    assert result == {'status': 'failed', 'error': 'Unsupported format'}
    chunking.get_audio_duration.assert_not_called()
    starting_service._before_new_operation.assert_not_called()
    chunking.run.start.assert_not_called()
    starting_service._start_operation.assert_not_called()


@override_settings(GS_BUCKET_NAME='kobo-bucket')
def test_store_chunk_file_uploads_to_a_place_fixed_by_version_and_index():
    """
    Preparing the same run again replaces its files rather than adding copies
    """
    service = object.__new__(GoogleTranscriptionService)
    service.bucket = MagicMock()

    with patch(f'{SERVICE_MODULE}.constance') as constance:
        constance.config.ASR_MT_GOOGLE_STORAGE_BUCKET_PREFIX = 'asr'
        uri = service.store_chunk_file('/tmp/work/chunk_002.flac', 'version-1', 2)

    service.bucket.blob.assert_called_once_with(
        'asr/speech-v2/chunks/version-1/002.flac'
    )
    service.bucket.blob.return_value.upload_from_filename.assert_called_once_with(
        '/tmp/work/chunk_002.flac', content_type='audio/flac'
    )
    assert uri == 'gs://kobo-bucket/asr/speech-v2/chunks/version-1/002.flac'


@pytest.mark.parametrize(
    'error, expected',
    [
        # What the client raises once its own retries run out
        (
            RetryError('Timeout of 120.0s exceeded', ServiceUnavailable('GCS is down')),
            ChunkStorageError,
        ),
        (Forbidden('no storage.objects.create access'), ChunkStorageRefusedError),
        (NotFound('bucket does not exist'), ChunkStorageRefusedError),
    ],
)
def test_store_chunk_file_tells_errors_that_may_pass_from_refusals(error, expected):
    """
    The chunking code knows nothing about Google, so the errors it acts on are
    its own: one is tried again on the next poll, the other fails the run
    """
    service = object.__new__(GoogleTranscriptionService)
    service.bucket = MagicMock()
    service.bucket.blob.return_value.upload_from_filename.side_effect = error

    with patch(f'{SERVICE_MODULE}.constance'), pytest.raises(expected):
        service.store_chunk_file('/tmp/work/chunk_000.flac', 'version-1', 0)


CHUNK_CONFIG = SpeechConfig('en-US', 'chirp_3', 'eu')


def _get_chunk(retry_count: int = 0) -> SimpleNamespace:
    return SimpleNamespace(
        index=1,
        version_uuid='version-1',
        retry_count=retry_count,
        file_path='gs://kobo-bucket/asr/speech-v2/chunks/version-1/001.flac',
        service_id='projects/kobo/locations/us/operations/42',
    )


def test_starting_a_chunk_submits_its_job_without_waiting():
    service = _get_service_for_process_data()
    service._batch_recognize = MagicMock(
        return_value=MagicMock(operation=SimpleNamespace(name='operations/1'))
    )

    with patch(f'{SERVICE_MODULE}.require_service_quota') as require_quota:
        report = service.start_chunk(_get_chunk(retry_count=1), CHUNK_CONFIG)

    require_quota.assert_called_once_with('speech_v2_batch_recognize')
    service._batch_recognize.assert_called_once_with(
        'gs://kobo-bucket/asr/speech-v2/chunks/version-1/001.flac',
        # Next to the chunk file, one folder per attempt
        'asr/speech-v2/chunks/version-1/001/1',
        CHUNK_CONFIG,
    )
    service._batch_recognize.return_value.result.assert_not_called()
    assert report.status == 'in_progress'
    assert report.service_id == 'operations/1'


@pytest.mark.parametrize(
    'error, status, retryable',
    [
        (InvalidArgument('bad request'), 'failed', False),
        (PermissionDenied('permission denied'), 'failed', False),
        (Unauthenticated('invalid credentials'), 'failed', False),
        # Not sent: sent again as the same attempt
        (ServiceUnavailable('unreachable'), 'in_progress', True),
        # Maybe sent: sent again as a new attempt, with its own output folder
        (DeadlineExceeded('timed out'), 'failed', True),
        # Unexpected: sent again as a new attempt, keeping the error
        (RuntimeError('unexpected'), 'failed', True),
    ],
)
def test_a_chunk_google_does_not_take_is_reported(error, status, retryable):
    service = _get_service_for_process_data()
    service._batch_recognize = MagicMock(side_effect=error)

    with patch(f'{SERVICE_MODULE}.require_service_quota'):
        report = service.start_chunk(_get_chunk(), CHUNK_CONFIG)

    assert report.status == status
    assert report.service_id is None
    assert report.retryable is retryable


def test_a_chunk_started_out_of_quota_is_retried_later():
    service = _get_service_for_process_data()
    service._batch_recognize = MagicMock(side_effect=ResourceExhausted('quota'))

    with patch(f'{SERVICE_MODULE}.require_service_quota'), pytest.raises(
        ServiceQuotaExceededError
    ):
        service.start_chunk(_get_chunk(), CHUNK_CONFIG)


def test_a_chunk_is_checked_where_its_job_runs():
    service = _get_service_for_process_data()
    service._check_batch_operation = MagicMock()
    chunk = _get_chunk(retry_count=1)

    assert service.check_chunk(chunk) is service._check_batch_operation.return_value
    service._check_batch_operation.assert_called_once_with(
        chunk.service_id, 'us', 'asr/speech-v2/chunks/version-1/001/1'
    )
