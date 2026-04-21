from __future__ import annotations

import hashlib
import json
import posixpath
from concurrent.futures import TimeoutError
from datetime import timedelta
from typing import Any, Union

import constance
from django.apps import apps
from django.conf import settings
from django.core.cache import cache
from google.api_core import client_options
from google.api_core.exceptions import InvalidArgument
from google.cloud import speech_v2 as speech
from google.protobuf.json_format import MessageToDict

from kobo.apps.languages.exceptions import LanguageNotSupported
from kobo.apps.languages.models.transcription import TranscriptionService
from kpi.exceptions import (
    AttachmentNotFoundException,
    InvalidXPathException,
    NotSupportedFormatException,
    SubmissionNotFoundException,
    XPathNotFoundException,
)
from kpi.utils.log import logging
from ...constants import GOOGLE_CACHE_TIMEOUT, GOOGLE_CODE
from ...exceptions import AudioTooLongError, SubsequenceTimeoutError
from .base import GoogleService

# https://cloud.google.com/speech-to-text/docs/quotas
ASYNC_MAX_LENGTH = timedelta(minutes=479)
DEFAULT_SPEECH_LOCATION = 'global'
DEFAULT_SPEECH_MODEL = 'latest_long'


class GoogleTranscriptionService(GoogleService):
    API_NAME = 'speech'
    API_VERSION = 'v2'
    API_RESOURCE = 'projects.locations.operations'

    def __init__(self, submission: dict, asset: 'kpi.models.Asset', *args, **kwargs):
        """
        This service takes a submission object as a GoogleService inheriting
        class. It uses Google Cloud Speech-to-Text v2 batch API.
        """
        super().__init__(submission=submission, asset=asset, *args, **kwargs)
        self.destination_path = None

    def adapt_response(self, response: Union[dict, list]) -> str:
        """
        Extract transcript segments from a Google Speech-to-Text v2 JSON payload
        """
        transcripts = []

        def _collect(payload):
            if isinstance(payload, dict):
                alternatives = payload.get('alternatives')
                if isinstance(alternatives, list) and alternatives:
                    transcript = alternatives[0].get('transcript')
                    if transcript:
                        transcripts.append(transcript.strip())
                        return

                for key in (
                    'response',
                    'results',
                    'transcript',
                    'inline_result',
                    'inlineResult',
                ):
                    if key in payload:
                        _collect(payload[key])
            elif isinstance(payload, list):
                for item in payload:
                    _collect(item)

        _collect(response)
        return ' '.join([item for item in transcripts if item]).strip()

    def begin_google_operation(
        self,
        xpath: str,
        source_lang: str,
        target_lang: str,
        content: Any,
        *,
        location_code: str | None = None,
        model_code: str | None = None,
    ) -> tuple[object, int]:
        """
        Set up a batch transcription operation
        """
        flac_content, duration = content
        total_seconds = int(duration.total_seconds())
        if duration >= ASYNC_MAX_LENGTH:
            raise AudioTooLongError(
                'Audio file of duration %s is too long.' % duration
            )

        speech_location = location_code or DEFAULT_SPEECH_LOCATION
        speech_model = model_code or DEFAULT_SPEECH_MODEL
        speech_client = self._get_speech_client(speech_location)
        input_path, output_prefix = self._get_batch_paths(xpath, source_lang)

        logging.info(
            'Starting Google automatic transcription for '
            f'{self.submission_root_uuid=}, {xpath=}, {source_lang=}, '
            f'{speech_location=}, {speech_model=}'
        )
        self._cleanup_batch_files(xpath, source_lang)
        gcs_input_uri = self.store_file(flac_content, input_path)

        request = speech.BatchRecognizeRequest(
            recognizer=self._get_recognizer_name(speech_location),
            config=speech.RecognitionConfig(
                auto_decoding_config=speech.AutoDetectDecodingConfig(),
                language_codes=[source_lang],
                model=speech_model,
                features=speech.RecognitionFeatures(
                    enable_automatic_punctuation=True
                ),
            ),
            files=[speech.BatchRecognizeFileMetadata(uri=gcs_input_uri)],
            recognition_output_config=speech.RecognitionOutputConfig(
                gcs_output_config=speech.GcsOutputConfig(
                    uri=f'gs://{settings.GS_BUCKET_NAME}/{output_prefix}/'
                )
            ),
        )

        return speech_client.batch_recognize(request=request), total_seconds

    @property
    def counter_name(self):
        return 'google_asr_seconds'

    def get_converted_audio(
        self, xpath: str, submission_uuid: int, user: object
    ) -> Union[bytes, tuple[bytes, timedelta]]:
        """
        Converts attachment audio or video file to flac
        """

        attachment = self.asset.deployment.get_attachment(
            submission_uuid, user, xpath=xpath
        )
        return attachment.get_transcoded_audio('flac', include_duration=True)

    def process_data(self, xpath: str, params: dict) -> dict:
        """
        Start or resume a single-submission transcription request

        - return `in_progress` while Google is still processing
        - return `complete` with a transcript when results are available
        - return `failed` with a user-facing error for expected failures

        NOTE: Current implementation submits one Google batch job per submission.
        This is correct for both single and bulk transcription today.

        A future optimisation would collect all audio files for a SubsequenceBulkAction
        into a single BatchRecognizeRequest, reducing API overhead and potentially
        lowering cost. This requires:
        - SubsequenceBulkAction / SubsequenceBulkActionItem models
        - A fan-out step to map GCS output files back to individual items
        """
        requested_language = params.get('locale') or params['language']
        try:
            language_config = self._get_google_language_config(requested_language)
        except LanguageNotSupported as err:
            message = str(err) or (
                f'Transcription is not supported for language "{requested_language}"'
            )
            return {'status': 'failed', 'error': message}

        source_language = language_config.language_code
        bulk_action_uid = params.get('bulk_action_uid')
        operation_name = self._get_operation_reference(
            xpath, source_language, bulk_action_uid
        )

        # If no operation reference exists, this is treated as the first request for
        # the given submission/language pair, and a new Google batch job is created
        if not operation_name:
            try:
                converted_audio = self.get_converted_audio(
                    xpath,
                    self.submission_root_uuid,
                    self.asset.owner,
                )
            except SubmissionNotFoundException:
                return {'status': 'failed', 'error': 'Submission not found'}
            except AttachmentNotFoundException:
                return {'status': 'failed', 'error': 'Attachment not found'}
            except (InvalidXPathException, XPathNotFoundException):
                return {'status': 'failed', 'error': 'Invalid question name XPath'}
            except NotSupportedFormatException:
                return {'status': 'failed', 'error': 'Unsupported format'}

            try:
                # Launch a new batch job
                operation, amount = self.begin_google_operation(
                    xpath,
                    source_lang=source_language,
                    target_lang=None,
                    content=converted_audio,
                    location_code=language_config.location_code,
                    model_code=language_config.model_code,
                )
            except AudioTooLongError as err:
                return {'status': 'failed', 'error': str(err)}
            except InvalidArgument as err:
                logging.error(
                    f'Google API rejected transcription request for {xpath=}: {err}'
                )
                return {
                    'status': 'failed',
                    'error': f'Transcription failed with error {str(err)}',
                }

            operation_name = operation.operation.name
            self.update_counters(amount)
            self._save_operation_reference(
                xpath, source_language, bulk_action_uid, operation_name
            )

            try:
                operation.result(
                    timeout=constance.config.ASR_MT_GOOGLE_REQUEST_TIMEOUT
                )

                # If Google finished within the request timeout, read the
                # output immediately and return a completed response
                value = self._read_batch_result(xpath, source_language)
                self._clear_operation_reference(xpath, source_language, bulk_action_uid)
                return {
                    'status': 'complete',
                    'value': value,
                }
            except TimeoutError:
                return {'status': 'in_progress'}
            except InvalidArgument as err:
                logging.error(f'No transcriptions found for xpath={xpath}')
                self._clear_operation_reference(
                    xpath, source_language, bulk_action_uid
                )
                return {
                    'status': 'failed',
                    'error': f'Transcription failed with error {str(err)}',
                }

        try:
            # For existing operations, poll the long-running operation and only
            # read the batch result after Google reports completion
            operation_payload = self._get_operation_payload(
                operation_name,
                language_config.location_code,
            )
            if not operation_payload.get('done'):
                raise SubsequenceTimeoutError

            if operation_payload.get('error'):
                error = operation_payload['error'].get('message') or str(
                    operation_payload['error']
                )
                self._clear_operation_reference(
                    xpath, source_language, bulk_action_uid
                )
                return {
                    'status': 'failed',
                    'error': f'Transcription failed with error {error}',
                }

            value = self._read_batch_result(xpath, source_language)
        except SubsequenceTimeoutError:
            logging.info(
                'Google batch transcription still running for '
                f'{xpath=}, {self.submission_root_uuid=}'
            )
            return {'status': 'in_progress'}
        except InvalidArgument as err:
            logging.error(f'No transcriptions found for xpath={xpath}')
            self._clear_operation_reference(xpath, source_language, bulk_action_uid)
            return {
                'status': 'failed',
                'error': f'Transcription failed with error {str(err)}',
            }

        self._clear_operation_reference(xpath, source_language, bulk_action_uid)
        return {
            'status': 'complete',
            'value': value,
        }

    def store_file(self, content: bytes, destination_path: str) -> str:
        """
        Store temporary file. Needed to avoid limits.
        Set Life cycle expiration to delete after 1 day
        https://cloud.google.com/storage/docs/lifecycle
        """
        self.destination_path = destination_path
        destination = self.bucket.blob(self.destination_path)
        destination.upload_from_string(
            content,
            content_type='audio/flac',
        )
        return f'gs://{settings.GS_BUCKET_NAME}/{self.destination_path}'

    def _get_google_language_config(self, requested_language: str):
        """
        Resolve the speech configuration for the user request
        """
        transcription_lang_service = TranscriptionService.objects.get(
            code=GOOGLE_CODE
        )
        return transcription_lang_service.get_configuration(requested_language)

    def _get_batch_paths(
        self, xpath: str, source_lang: str
    ) -> tuple[str, str]:
        """
        Build deterministic GCS paths for the input file and batch output

        Using a stable hash lets later polling requests find the same output
        directory without storing an extra output-path field in the database.
        """
        base_hash = hashlib.md5(
            ':'.join(
                [
                    str(self.asset.owner_id),
                    self.submission_root_uuid,
                    xpath,
                    source_lang.lower(),
                ]
            ).encode()
        ).hexdigest()[:16]

        base_dir = posixpath.join(
            constance.config.ASR_MT_GOOGLE_STORAGE_BUCKET_PREFIX,
            'speech-v2',
            base_hash,
        )
        return (
            posixpath.join(base_dir, 'input.flac'),
            posixpath.join(base_dir, 'output'),
        )

    def _cleanup_batch_files(self, xpath: str, source_lang: str) -> None:
        """
        Remove previous input/output files for the same submission/xpath/language

        Retranscriptions reuse the same deterministic prefix, so stale JSON
        files must be deleted first to avoid concatenating old transcripts.
        """
        input_path, output_prefix = self._get_batch_paths(xpath, source_lang)
        for prefix in (input_path, output_prefix):
            for blob in self.bucket.list_blobs(prefix=prefix):
                blob.delete()

    def _get_speech_client(self, location: str):
        """
        Create a Speech client bound to the configured regional endpoint
        """
        client_kwargs = {'credentials': self.credentials}
        if location != DEFAULT_SPEECH_LOCATION:
            client_kwargs['client_options'] = client_options.ClientOptions(
                api_endpoint=f'{location}-speech.googleapis.com'
            )
        return speech.SpeechClient(**client_kwargs)

    def _get_recognizer_name(self, location: str) -> str:
        """
        Return the implicit recognizer path used by Speech-to-Text v2.
        """
        return (
            f'projects/{constance.config.ASR_MT_GOOGLE_PROJECT_ID}/'
            f'locations/{location}/recognizers/_'
        )

    def _get_operation_payload(
        self,
        operation_name: str,
        location_code: str | None = None,
    ) -> dict:
        """
        Poll the Google long-running operation backing the batch request.
        """
        speech_client = self._get_speech_client(
            location_code or DEFAULT_SPEECH_LOCATION
        )
        operation = speech_client.transport.operations_client.get_operation(
            operation_name
        )
        return MessageToDict(
            operation._pb if hasattr(operation, '_pb') else operation,
            preserving_proto_field_name=True,
        )

    def _read_batch_result(self, xpath: str, source_lang: str) -> str:
        """
        Read the completed transcript from the JSON files written to GCS
        """
        _, output_prefix = self._get_batch_paths(xpath, source_lang)
        transcript_parts = []
        blobs = sorted(
            self.bucket.list_blobs(prefix=output_prefix),
            key=lambda blob: blob.name,
        )
        for blob in blobs:
            if not blob.name.endswith('.json'):
                continue

            transcript = self.adapt_response(json.loads(blob.download_as_text()))
            if transcript:
                transcript_parts.append(transcript)

        if not transcript_parts:
            raise InvalidArgument(
                'No transcription JSON result files were found in Google Cloud '
                'Storage.'
            )

        return ' '.join(transcript_parts).strip()

    def _get_bulk_action_item(self, bulk_action_uid: str | None):
        """
        Note: This method is designed to support future bulk transcription feature.

        Retrieve the SubsequenceBulkActionItem associated with this submission

        Current behavior:
        The `SubsequenceBulkActionItem` model is not yet implemented. When the
        model is unavailable, this method returns `None` and the system falls
        back to cache-based operation tracking.

        Future behavior:
        Once the model is implemented, this method will:

        1. Look up the bulk action item using:
           - parent UID (bulk_action_uid)
           - submission_root_uuid
        2. Return the matching database record if found.
        3. Return None if the item does not exist.

        This allows bulk transcription operations to store their Google
        operation identifiers in the database rather than cache.
        """
        if not bulk_action_uid:
            return None

        try:
            SubsequenceBulkActionItem = apps.get_model(  # noqa: N806
                'subsequences',
                'SubsequenceBulkActionItem',
            )
        except LookupError:
            logging.info(
                'bulk_action_uid was provided but SubsequenceBulkActionItem '
                'is not available yet; using cache fallback'
            )
            return None

        try:
            return SubsequenceBulkActionItem.objects.get(
                parent__uid=bulk_action_uid,
                submission_root_uuid=self.submission_root_uuid,
            )
        except SubsequenceBulkActionItem.DoesNotExist:
            logging.warning(
                'No SubsequenceBulkActionItem found for '
                f'{bulk_action_uid=}, {self.submission_root_uuid=}'
            )
            return None

    def _get_operation_reference(
        self,
        xpath: str,
        source_lang: str,
        bulk_action_uid: str | None,
    ) -> str | None:
        """
        Fetch the persisted Google operation id from bulk storage or cache
        """
        bulk_action_item = self._get_bulk_action_item(bulk_action_uid)
        if bulk_action_item and bulk_action_item.service_id:
            return bulk_action_item.service_id

        cache_key = self._get_cache_key(xpath, source_lang, target_lang=None)
        return cache.get(cache_key)

    def _save_operation_reference(
        self,
        xpath: str,
        source_lang: str,
        bulk_action_uid: str | None,
        operation_name: str,
    ) -> None:
        """
        Persist the operation id so later polls can resume the same job
        """
        bulk_action_item = self._get_bulk_action_item(bulk_action_uid)
        if bulk_action_item:
            bulk_action_item.service_id = operation_name
            bulk_action_item.save(update_fields=['service_id', 'date_modified'])
            return

        cache_key = self._get_cache_key(xpath, source_lang, target_lang=None)
        cache.set(cache_key, operation_name, timeout=GOOGLE_CACHE_TIMEOUT)

    def _clear_operation_reference(
        self,
        xpath: str,
        source_lang: str,
        bulk_action_uid: str | None,
    ) -> None:
        """
        Remove the stored operation id after completion or terminal failure.
        """
        bulk_action_item = self._get_bulk_action_item(bulk_action_uid)
        if bulk_action_item:
            bulk_action_item.service_id = ''
            bulk_action_item.save(update_fields=['service_id', 'date_modified'])
            return

        cache_key = self._get_cache_key(xpath, source_lang, target_lang=None)
        cache.delete(cache_key)
