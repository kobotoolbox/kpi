# coding: utf-8
import uuid
import posixpath
from concurrent.futures import TimeoutError
from datetime import timedelta

import constance
from django.conf import settings
from django.contrib.auth.models import User
from google.cloud import speech, storage

from .base import GoogleTask
from ...exceptions import (
    AudioTooLongError,
    SubsequenceTimeoutError,
    TranscriptionResultsNotFound,
)

REQUEST_TIMEOUT = 10  # seconds
# https://cloud.google.com/speech-to-text/quotas#content
ASYNC_MAX_LENGTH = timedelta(minutes=479)
SYNC_MAX_LENGTH = timedelta(seconds=59)
SYNC_MAX_BYTES = 10000000  # 10MB


class AutoTranscription:
    """
    The engine for transcribing audio files
    """
    def store_transcript(self, transcript, asset, submission_id):
        pass


class GoogleTranscribeEngine(AutoTranscription, GoogleTask):
    def __init__(self):
        super().__init__()
        self.destination_path = None
        self.storage_client = storage.Client(credentials=self.credentials)
        self.bucket = self.storage_client.bucket(bucket_name=settings.GS_BUCKET_NAME)

    def get_converted_audio(
            self,
            xpath: str,
            submission_id: int,
            user: object
    ):
        attachment = self.asset.deployment.get_attachment(
            submission_id, user, xpath=xpath
        )
        return attachment.get_transcoded_audio('flac', include_duration=True)

    def store_file(self, content):
        # Store temporary file. Needed to avoid limits.
        # Set Life cycle expiration to delete after 1 day
        # https://cloud.google.com/storage/docs/lifecycle
        self.destination_path = posixpath.join(
            constance.config.ASR_MT_GOOGLE_STORAGE_BUCKET_PREFIX,
            f'{uuid.uuid4()}.flac'
        )

        # send the audio file to google storage
        destination = self.bucket.blob(self.destination_path)
        destination.upload_from_string(
            content,
            content_type='audio/flac',
        )
        return self.destination_path

    def transcribe_file(
            self,
            asset,
            xpath: str,
            # note: this works with a uuid string ontop of cdd172b
            submission_id: int,
            source: str,
            user: User,
    ):
        """
        Transcribe file with cache layer around Google operations
        When speech api times out, rerun function with same params
        to check if operation is finished and return results
        """
        self.asset = asset
        self.user = user

        return self.handle_google_task_asynchronously('speech', 'v1', 'operations', user.pk, submission_id, xpath, source)

    def begin_async_google_operation(self, submission_id, xpath, source):
        # get the audio file in a Google supported format
        flac_content, duration = self.get_converted_audio(
            xpath=xpath,
            submission_id=submission_id,
            user=self.user,
        )
        total_seconds = int(duration.total_seconds())
        # Create the parameters required for the transcription
        speech_client = speech.SpeechClient(
            credentials=self.credentials
        )
        config = speech.RecognitionConfig(
            language_code=source,
            enable_automatic_punctuation=True,
        )

        if duration < SYNC_MAX_LENGTH and len(flac_content) < SYNC_MAX_BYTES:
            # Performance optimization, it's faster directly
            audio = speech.RecognitionAudio(content=flac_content)
        elif duration < ASYNC_MAX_LENGTH:
            # Store larger files on gcloud
            gcs_path = self.store_file(flac_content)
            audio = speech.RecognitionAudio(uri=f'gs://{settings.GS_BUCKET_NAME}/{gcs_path}')
        else:
            raise AudioTooLongError('Audio file of duration %s is too long.' % duration)

        speech_results = speech_client.long_running_recognize(audio=audio, config=config)
        return (speech_results, total_seconds)

    @property
    def counter_name(self):
        return 'google_asr_seconds'

    def append_operations_response(self, operation, *args):
        # operations api uses a dict, while speech api uses objects
        try:
            results = operation['response']['results']
        except KeyError:
            raise TranscriptionResultsNotFound
        transcript = []
        for result in results:
            alternatives = result['alternatives']
            transcript.append({
                'transcript': alternatives[0]['transcript'],
                'confidence': alternatives[0]['confidence'],
            })
        return transcript

    def append_api_response(self, results, *args):
        # ensure this object based version matches operations api version
        transcript = []
        for result in results:
            alternatives = result.alternatives
            transcript.append({
                'transcript': alternatives[0].transcript,
                'confidence': alternatives[0].confidence,
            })
        return transcript
