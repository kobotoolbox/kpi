from __future__ import annotations

import posixpath
import uuid
from datetime import timedelta
from typing import Any, Union

import constance
from django.conf import settings
from django.core.cache import cache
from google.api_core.exceptions import InvalidArgument
from google.cloud import speech

from kpi.utils.log import logging
from kpi.exceptions import (
    InvalidXPathException,
    SubmissionNotFoundException,
    XPathNotFoundException,
    AttachmentNotFoundException,
    NotSupportedFormatException,
)
from ...constants import SUBMISSION_UUID_FIELD
from ...exceptions import (
    AudioTooLongError,
    SubsequenceTimeoutError,
)
from ..utils.cache import generate_cache_key
from .base import GoogleService

# https://cloud.google.com/speech-to-text/quotas#content
ASYNC_MAX_LENGTH = timedelta(minutes=479)
SYNC_MAX_LENGTH = timedelta(seconds=59)
SYNC_MAX_BYTES = 10000000  # 10MB


class GoogleTranscriptionService(GoogleService):
    API_NAME = 'speech'
    API_VERSION = 'v1'
    API_RESOURCE = 'operations'

    def __init__(self, submission: dict, asset: 'kpi.models.Asset', *args, **kwargs):
        """
        This service takes a submission object as a GoogleService inheriting
        class. It uses google cloud transcript v1 API.
        """
        super().__init__(submission=submission, asset=asset, *args, **kwargs)
        self.destination_path = None

    def adapt_response(self, response: Union[dict, list]) -> str:
        """
        Extracts the transcript from a response from the google API
        """
        transcript = []
        if isinstance(response, dict):
            try:
                results = response['response']['results']
            except KeyError:
                return ''

            for result in results:
                alternatives = result['alternatives']
                transcript.append(alternatives[0]['transcript'])
        else:
            for result in response.results:
                alternatives = result.alternatives
                transcript.append(alternatives[0].transcript)
        result_string = ' '.join(transcript)
        return result_string

    def begin_google_operation(
        self,
        xpath: str,
        source_lang: str,
        target_lang: str,
        content: Any,
    ) -> tuple[str, int]:
        """
        Set up the transcription operation
        """
        submission_uuid = self.submission[SUBMISSION_UUID_FIELD]
        flac_content, duration = content
        total_seconds = int(duration.total_seconds())

        # Create the parameters required for the transcription
        speech_client = speech.SpeechClient(credentials=self.credentials)
        config = speech.RecognitionConfig(
            language_code=source_lang,
            enable_automatic_punctuation=True,
        )

        if duration < SYNC_MAX_LENGTH and len(flac_content) < SYNC_MAX_BYTES:
            logging.info(
                f'Sync transcription for {submission_uuid=}, {xpath=}'
            )
            # Performance optimization, it's faster directly
            audio = speech.RecognitionAudio(content=flac_content)
        elif duration < ASYNC_MAX_LENGTH:
            logging.info(
                f'Async transcription for {submission_uuid=}, {xpath=}'
            )
            # Stores larger files on gcloud
            gcs_path = self.store_file(flac_content)
            audio = speech.RecognitionAudio(
                uri=f'gs://{settings.GS_BUCKET_NAME}/{gcs_path}'
            )
        else:
            raise AudioTooLongError(
                'Audio file of duration %s is too long.' % duration
            )

        speech_results = speech_client.long_running_recognize(
            audio=audio, config=config
        )
        return speech_results, total_seconds

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
        source_language = params.get('locale') or params['language']
        cache_key = self._get_cache_key(xpath, source_language, target_lang=None)
        if cache.get(cache_key):
            # Operation is still in progress, no need to process the audio file
            converted_audio = None
        else:
            try:
                converted_audio = self.get_converted_audio(
                    xpath,
                    self.submission[SUBMISSION_UUID_FIELD],
                    self.asset.owner,
                )
            except SubmissionNotFoundException:
                return {
                    'status': 'failed',
                    'error': {f'Submission not found'},
                }
            except AttachmentNotFoundException:
                return {
                    'status': 'failed',
                    'error': {f'Attachment not found'},
                }
            except (InvalidXPathException,XPathNotFoundException):
                return {
                    'status': 'failed',
                    'error': {f'Invalid question name XPath'},
                }
            except NotSupportedFormatException:
                return {
                    'status': 'failed',
                    'error': 'Unsupported format'
                }

        try:
            value = self.handle_google_operation(
                xpath,
                source_lang=source_language,
                target_lang=None,
                content=converted_audio,
            )
        except SubsequenceTimeoutError:
            logging.error(
                f'Timeout error; async processing triggered for xpath={xpath}'
            )
            return {
                'status': 'in_progress',
            }
        except InvalidArgument as e:
            logging.error(f'No transcriptions found for xpath={xpath}')
            return {
                'status': 'failed',
                'error': f'Transcription failed with error {str(e)}'
            }

        return {
            'status': 'complete',
            'value': value,
        }

    def store_file(self, content):
        """
        Store temporary file. Needed to avoid limits.
        Set Life cycle expiration to delete after 1 day
        https://cloud.google.com/storage/docs/lifecycle
        """
        self.destination_path = posixpath.join(
            constance.config.ASR_MT_GOOGLE_STORAGE_BUCKET_PREFIX,
            f'{uuid.uuid4()}.flac',
        )

        # send the audio file to google storage
        destination = self.bucket.blob(self.destination_path)
        destination.upload_from_string(
            content,
            content_type='audio/flac',
        )
        return self.destination_path
