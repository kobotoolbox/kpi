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
from google.api_core.exceptions import (
    GoogleAPIError,
    InvalidArgument,
    PermissionDenied,
    ResourceExhausted,
    Unauthenticated,
)
from google.cloud import speech_v2 as speech
from google.cloud.exceptions import GoogleCloudError
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
from ...exceptions import (
    AudioTooLongError,
    GoogleQuotaExceededError,
    GoogleTranscriptionServiceNotConfigured,
    SubsequenceTimeoutError,
    TranscriptionResultNotFound
)
from .base import GoogleService
from .locations import (
    get_asr_language_code_overrides,
    get_speech_location_for_region,
    get_speech_location_for_model
)
from .rate_limit import (
    GoogleServiceRateLimitExceeded,
    get_google_retry_after_seconds,
    require_google_service_quota,
)

# https://cloud.google.com/speech-to-text/docs/quotas
ASYNC_MAX_LENGTH = timedelta(minutes=479)

# Fallback STT model used when a language has no `model_code` set in the
# `TranscriptionServiceLanguageM2M` database table. 'chirp_3' is chosen over
# 'long' because it is available for every language in the 'us' and 'eu'
# multi-region endpoints, and it supports all recognition features
# (e.g. enable_automatic_punctuation)
DEFAULT_SPEECH_MODEL = 'chirp_3'


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

    def adapt_response(self, response: Union[dict, list]) -> str:
        """
        Extract transcript segments from Google Speech-to-Text v2 JSON payloads

        We currently read results from JSON files stored in GCS, but the nested
        shape can vary slightly between inline responses and batch output files.
        This walker looks for `alternatives[0].transcript` anywhere under the
        common wrapper keys that Google uses for those payloads.
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
        model_code: str | None = None,
        speech_location: str | None = None,
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

        speech_model = model_code or DEFAULT_SPEECH_MODEL
        if speech_location is None:
            speech_location = get_speech_location_for_region()
        speech_client = self._get_speech_client(speech_location)
        input_path, output_prefix = self._get_batch_paths(xpath, source_lang)

        logging.info(
            'Starting Google automatic transcription for '
            f'{self.submission_root_uuid=}, {xpath=}, {source_lang=}, '
            f'{speech_location=}, {speech_model=}'
        )
        # Check Redis bucket and halt locally if we are exceeding allowed requests
        require_google_service_quota('speech_v2_batch_recognize')
        self._cleanup_batch_files(xpath, source_lang)
        gcs_input_uri = self.store_file(flac_content, input_path)

        request = speech.BatchRecognizeRequest(
            recognizer=self._get_recognizer_name(speech_location),
            config=speech.RecognitionConfig(
                auto_decoding_config=speech.AutoDetectDecodingConfig(),
                language_codes=[source_lang],
                model=speech_model,
                features=speech.RecognitionFeatures(
                    # chirp_3, chirp_2, and chirp support automatic punctuation
                    # for all languages. 'long' does not support it for several
                    # languages, including the 6 legacy African languages
                    # (Kinyarwanda, Swati, Southern Sotho, Tswana, Tsonga, Venda),
                    # and will return a 400 error if enabled
                    enable_automatic_punctuation=(speech_model != 'long'),
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

    def process_data(
        self,
        xpath: str,
        params: dict,
        bulk_action_uid: str | None = None,
    ) -> dict:
        """
        Start or resume a single-submission transcription request

        Returns:
        - `in_progress` while Google is still processing
        - `complete` with a transcript when results are available
        - `failed` with a user-facing error for expected failures

        Quota Management Flow:
        1. INTERNAL CHECK: Before reaching out to Google, require_google_service_quota()
           checks our Redis token bucket. If we are sending too many requests,
           it raises GoogleServiceRateLimitExceeded and Celery is told to wait.
        2. EXTERNAL CHECK: If Google's servers reject our request, we catch
           ResourceExhausted. We read Google's 'Retry-After' header and tell
           Celery to sleep for that exact amount of time.
        3. FALLBACK: If a standard network error occurs, we return 'in_progress'
           to let Celery's standard exponential backoff try again safely.

        NOTE: The current implementation intentionally submits one Google batch
        job per submission. This allows us to track the progress of a batch
        request on a per-file basis, which is the correct behavior for both
        single and bulk transcriptions.
        """
        requested_language = params.get('locale') or params['language']
        try:
            language_config = self._get_google_language_config(requested_language)
        except GoogleTranscriptionServiceNotConfigured as err:
            return {'status': 'failed', 'error': str(err)}
        except LanguageNotSupported as err:
            message = str(err) or (
                f'Transcription is not supported for language "{requested_language}"'
            )
            return {'status': 'failed', 'error': message}

        source_language = language_config.language_code

        # Apply any configured language-code override before sending the
        # request to Google Speech-to-Text
        #
        # This allows temporary workarounds for Google side issues (for
        # example, mapping 'sw' to 'auto') without changing Kobo's language
        # definitions or requiring a code deployment
        asr_overrides = get_asr_language_code_overrides()
        if source_language in asr_overrides:
            override_value = asr_overrides[source_language]
            logging.info(
                'Applying ASR language override: %s -> %s',
                source_language,
                override_value,
            )
            source_language = override_value

        speech_location = (
            get_speech_location_for_model(language_config.model_code)
            or language_config.location_code
            or get_speech_location_for_region()
        )

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
                    model_code=language_config.model_code,
                    speech_location=speech_location,
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
            except GoogleServiceRateLimitExceeded as err:
                logging.info(
                    'Deferred Google transcription start because project quota '
                    f'is exhausted for {xpath=}, '
                    f'retry_after={err.retry_after}'
                )
                raise
            except ResourceExhausted as err:
                retry_after = get_google_retry_after_seconds(err)
                logging.warning(
                    'Google transcription quota was exhausted while starting '
                    f'{xpath=}, retry_after={retry_after}: {err}'
                )
                raise GoogleQuotaExceededError(retry_after=retry_after) from err
            except (GoogleAPIError, GoogleCloudError) as err:
                # Unable to reach Google to start the transcription job,
                # return 'in_progress' to allow celery to retry
                logging.error(
                    f'Google infrastructure error while starting transcription '
                    f'for {xpath=}: {err}'
                )
                return {'status': 'in_progress'}
            except Exception as err:
                self._clear_operation_reference(xpath, source_language, bulk_action_uid)
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
                result = operation.result(
                    timeout=constance.config.ASR_MT_GOOGLE_REQUEST_TIMEOUT
                )

                # Google may complete the batch request within this synchronous wait,
                # but individual input files can still fail even when the operation
                # itself succeeds. Check the BatchRecognizeResponse for per-file
                # errors before attempting to read transcription output from GCS
                per_file_error = self._extract_per_file_error(result)
                if per_file_error:
                    logging.error(
                        f'Google batch per-file error for {xpath=}, '
                        f'{self.submission_root_uuid=}, '
                        f'operation={operation_name}: {per_file_error}'
                    )
                    self._clear_operation_reference(
                        xpath, source_language, bulk_action_uid
                    )
                    return {
                        'status': 'failed',
                        'error': (
                            f'Transcription failed with error {per_file_error}'
                        ),
                    }

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
            except TranscriptionResultNotFound as err:
                logging.error(
                    f'No transcription output written to GCS for {xpath=}, '
                    f'{self.submission_root_uuid=}, operation={operation_name}: '
                    f'{err}'
                )
                self._clear_operation_reference(
                    xpath, source_language, bulk_action_uid
                )
                return {
                    'status': 'failed',
                    'error': (
                        f'Transcription failed with error: {str(err)} '
                        'It is possible Google was unable to transcribe the audio.'
                    ),
                }
            except ResourceExhausted as err:
                retry_after = get_google_retry_after_seconds(err)
                logging.warning(
                    'Google transcription quota was exhausted while waiting for '
                    f'{xpath=}, retry_after={retry_after}: {err}'
                )
                raise GoogleQuotaExceededError(retry_after=retry_after) from err
            except (GoogleAPIError, GoogleCloudError) as err:
                # Unable to reach Google to check the operation status, but the
                # job may have still succeeded. Return 'in_progress' to allow Celery
                # to retry and check again later
                logging.error(f'Google operation failed for {xpath=}: {err}')
                return {'status': 'in_progress'}
            except Exception as err:
                self._clear_operation_reference(xpath, source_language, bulk_action_uid)
                return {
                    'status': 'failed',
                    'error': f'Transcription failed with error {str(err)}',
                }

        try:
            # For existing operations, poll the long-running operation and only
            # read the batch result after Google reports completion
            operation_payload = self._get_operation_payload(
                operation_name,
                speech_location,
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

            # Even when the long-running operation completes successfully
            # (`done=True` with no top-level error), individual input files may
            # still fail. Those failures are reported under
            # `response.results[<uri>].error`, and Google does not generate an
            # output JSON for those files. Checking here lets us return actual
            # error instead of a misleading 'no transcription output' message
            per_file_error = self._extract_per_file_error(
                operation_payload.get('response')
            )
            if per_file_error:
                logging.error(
                    f'Google batch per-file error while polling transcription '
                    f'for {xpath=}, {self.submission_root_uuid=}, '
                    f'operation={operation_name}: {per_file_error}'
                )
                self._clear_operation_reference(
                    xpath, source_language, bulk_action_uid
                )
                return {
                    'status': 'failed',
                    'error': f'Transcription failed with error {per_file_error}',
                }

            value = self._read_batch_result(xpath, source_language)
        except SubsequenceTimeoutError:
            logging.info(
                'Google batch transcription still running for '
                f'{xpath=}, {self.submission_root_uuid=}'
            )
            return {'status': 'in_progress'}
        except TranscriptionResultNotFound as err:
            logging.error(
                f'No transcription output written to GCS for {xpath=}, '
                f'{self.submission_root_uuid=}, operation={operation_name}, '
                f'payload={operation_payload}: {err}'
            )
            self._clear_operation_reference(xpath, source_language, bulk_action_uid)
            return {
                'status': 'failed',
                'error': (
                    f'Transcription failed with error {str(err)}. '
                    'It is possible Google was unable to transcribe the audio.'
                ),
            }
        except (PermissionDenied, Unauthenticated) as err:
            logging.error(
                f'Google authentication or permission error while polling '
                f'transcription for {xpath=}: {err}'
            )
            self._clear_operation_reference(xpath, source_language, bulk_action_uid)
            return {
                'status': 'failed',
                'error': (
                    'Transcription failed because Google credentials or '
                    f'permissions are invalid: {str(err)}'
                ),
            }
        except ResourceExhausted as err:
            retry_after = get_google_retry_after_seconds(err)
            logging.warning(
                'Google transcription quota was exhausted while polling '
                f'{xpath=}, retry_after={retry_after}: {err}'
            )
            raise GoogleQuotaExceededError(retry_after=retry_after) from err
        except (GoogleAPIError, GoogleCloudError) as err:
            # Unable to reach Google to check the operation status.
            # The transcription may still be running, so return 'in_progress'
            # to allow Celery to retry instead of marking the task as failed
            logging.error(
                f'Google infrastructure error while polling transcription '
                f'for {xpath=}: {err}'
            )
            return {'status': 'in_progress'}
        except Exception as err:
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
        destination = self.bucket.blob(destination_path)
        destination.upload_from_string(
            content,
            content_type='audio/flac',
        )
        return f'gs://{settings.GS_BUCKET_NAME}/{destination_path}'

    def _get_google_language_config(self, requested_language: str):
        """
        Resolve the speech configuration for the user request
        """
        try:
            transcription_lang_service = TranscriptionService.objects.get(
                code=GOOGLE_CODE
            )
        except TranscriptionService.DoesNotExist:
            raise GoogleTranscriptionServiceNotConfigured(
                'Google transcription service is not configured.'
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
            ).encode(),
            usedforsecurity=False,
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
        return speech.SpeechClient(
            credentials=self.credentials,
            client_options=client_options.ClientOptions(
                api_endpoint=f'{location}-speech.googleapis.com'
            ),
        )

    def _get_recognizer_name(self, location: str) -> str:
        """
        Return the implicit recognizer path used by Speech-to-Text v2.
        """
        return (
            f'projects/{constance.config.ASR_MT_GOOGLE_PROJECT_ID}/'
            f'locations/{location}/recognizers/_'
        )

    def cancel_google_operation(self, operation_name: str) -> None:
        """
        Parse the GCP location from a long-running operation resource name and
        cancel a previously started Google long-running operation

        STT v2 operation names follow the pattern:
            projects/{project}/locations/{location}/operations/{id}
        """
        try:
            parts = operation_name.split('/')
            location = parts[parts.index('locations') + 1]
        except (ValueError, IndexError):
            location = get_speech_location_for_region()

        speech_client = self._get_speech_client(location)
        speech_client.transport.operations_client.cancel_operation(name=operation_name)

    def _get_operation_payload(
        self,
        operation_name: str,
        speech_location: str,
    ) -> dict:
        """
        Poll the Google long-running operation backing the batch request
        """
        speech_client = self._get_speech_client(speech_location)
        operation = speech_client.transport.operations_client.get_operation(
            operation_name
        )
        return MessageToDict(
            operation._pb if hasattr(operation, '_pb') else operation,
            preserving_proto_field_name=True,
        )

    def _extract_per_file_error(self, response) -> str | None:
        """
        Return a user-facing error message if Google's BatchRecognizeResponse
        reports a per-file error, otherwise None

        In Speech-to-Text v2 batch mode, an operation can complete successfully
        (`done=True`, no top-level error) while individual input files fail with
        reasons stored in `response.results[<uri>].error`. Google does not write
        a JSON output file for those inputs, so callers that only inspect GCS
        will see a missing-result condition without knowing the cause.

        Accepts either a `BatchRecognizeResponse` proto (as returned directly
        by `operation.result()`) or a dict (from the polling path, where the
        payload is already converted via `MessageToDict`).
        """
        if not response:
            return None

        # Normalise proto message to dict.
        if hasattr(response, 'DESCRIPTOR') or hasattr(response, '_pb'):
            response = MessageToDict(
                response._pb if hasattr(response, '_pb') else response,
                preserving_proto_field_name=True,
            )

        if not isinstance(response, dict):
            return None

        results = response.get('results') or {}
        for file_result in results.values():
            if not isinstance(file_result, dict):
                continue
            error = file_result.get('error')
            if not error:
                continue
            if isinstance(error, dict):
                return error.get('message') or str(error)
            return str(error)
        return None

    def _read_batch_result(self, xpath: str, source_lang: str) -> str:
        """
        Read the completed transcript from the JSON files written to GCS
        """
        _, output_prefix = self._get_batch_paths(xpath, source_lang)
        transcript_parts = []
        found_json_result = False
        blobs = sorted(
            self.bucket.list_blobs(prefix=output_prefix),
            key=lambda blob: blob.name,
        )
        for blob in blobs:
            if not blob.name.endswith('.json'):
                continue

            found_json_result = True
            transcript = self.adapt_response(json.loads(blob.download_as_text()))
            if transcript:
                transcript_parts.append(transcript)

        if not found_json_result:
            raise TranscriptionResultNotFound(
                'No transcription JSON result files were found in Google Cloud Storage.'
            )

        return ' '.join(transcript_parts).strip()

    def _get_bulk_action_item(self, bulk_action_uid: str | None):
        """
        Retrieve the `SubsequenceBulkActionItem` associated with this submission

        Returns the matching database record using the parent bulk action UID
        and the submission root UUID. This allows bulk transcriptions to track
        their Google operations in the database rather than falling back to cache.
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
                'bulk_action_uid was provided but the SubsequenceBulkActionItem '
                'model could not be loaded, using cache fallback'
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
        from ...models import PENDING_OPERATION_MARKER

        bulk_action_item = self._get_bulk_action_item(bulk_action_uid)
        if (
            bulk_action_item
            and bulk_action_item.service_id
            and bulk_action_item.service_id != PENDING_OPERATION_MARKER
        ):
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
