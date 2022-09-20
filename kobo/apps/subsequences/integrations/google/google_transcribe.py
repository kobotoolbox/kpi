# coding: utf-8
import uuid
from concurrent.futures import TimeoutError
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from googleapiclient import discovery

from google.cloud import speech, storage

from ...constants import GOOGLE_CACHE_TIMEOUT, make_async_cache_key
from ...exceptions import AudioTooLongError, SubsequenceTimeoutError
from .utils import google_credentials_from_constance_config

GS_BUCKET_PREFIX = "speech_tmp"
REQUEST_TIMEOUT = 30 # seconds
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


class GoogleTranscribeEngine(AutoTranscription):
    def __init__(self):
        self.asset = None
        self.destination_path = None
        self.credentials = google_credentials_from_constance_config()
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
        self.destination_path = (
            f'{GS_BUCKET_PREFIX}/{uuid.uuid4()}.flac'
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
            user: object,
    ):
        """
        Transcribe file with cache layer around Google operations
        When speech api times out, rerun function with same params
        to check if operation is finished and return results
        """
        self.asset = asset

        cache_key = make_async_cache_key(user.pk, submission_id, xpath, source)
        transcript = []
        # Stop Me If You Think You've Heard This One Before
        if operation_name := cache.get(cache_key):
            speech_service = discovery.build('speech', 'v1', credentials=self.credentials)
            operation = speech_service.operations().get(name=operation_name).execute()
            if not operation["done"]:
                raise SubsequenceTimeoutError
            # operations api uses a dict, while speech api uses objects
            for result in operation["response"]["results"]:
                alternatives = result["alternatives"]
                transcript.append({
                    'transcript': alternatives[0]["transcript"],
                    'confidence': alternatives[0]["confidence"],
                })
        else:
            # get the audio file in a Google supported format
            flac_content, duration = self.get_converted_audio(
                xpath=xpath,
                submission_id=submission_id,
                user=user,
            )
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
            cache.set(cache_key, speech_results.operation.name, GOOGLE_CACHE_TIMEOUT)
            try:
                result = speech_results.result(timeout=REQUEST_TIMEOUT)
            except TimeoutError as err:
                raise SubsequenceTimeoutError from err
            # ensure this object based version matches operations api version
            for result in result.results:
                alternatives = result.alternatives
                transcript.append({
                    'transcript': alternatives[0].transcript,
                    'confidence': alternatives[0].confidence,
                })

        cache.delete(cache_key)
        return transcript
