# coding: utf-8
import uuid
import posixpath
from abc import ABC, abstractmethod
from concurrent.futures import TimeoutError
from datetime import timedelta

import constance
from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from google.cloud import speech, storage
from googleapiclient import discovery

from kobo.apps.trackers.utils import update_nlp_counter
from .utils import google_credentials_from_constance_config
from ...constants import GOOGLE_CACHE_TIMEOUT, make_async_cache_key
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


class GoogleTransXEngine(ABC):
    """
    Base class for Google transcription/translation
    Contains common functions for returning async responses using the Operations API
    """

    def __init__(self):
        super().__init__()
        self.asset = None
        self.destination_path = None
        self.credentials = google_credentials_from_constance_config()
        self.storage_client = storage.Client(credentials=self.credentials)
        self.bucket = self.storage_client.bucket(bucket_name=settings.GS_BUCKET_NAME)

    @abstractmethod
    def begin_async_google_operation(self, *args: str) -> (object, int):
        return ({}, 0)

    @property
    @abstractmethod
    def counter_name(self):
        """
        Gets used by `update_nlp_counters()` - should begin with `google_`
        """
        return 'google_'

    def update_counters(self, amount) -> None:
        update_nlp_counter(
            self.counter_name,
            amount,
            self.asset.owner_id,
            self.asset.id,
        )

    @abstractmethod
    def append_operations_response(self, results, *args) -> [object]:
        pass

    @abstractmethod
    def append_api_response(self, results, *args) -> [object]:
        pass

    def handle_google_task_asynchronously(self, api_name, api_version, resource, *args):
        cache_key = make_async_cache_key(*args)
        # Stop Me If You Think You've Heard This One Before
        if operation_name := cache.get(cache_key):
            google_service = discovery.build(api_name, api_version, credentials=self.credentials)
            resource_path = resource.split('.')
            for subresource in resource_path:
                google_service = getattr(google_service, subresource)()
            operation = google_service.get(name=operation_name)
            operation = operation.execute()
            print(operation)
            if not (operation.get('done') or operation.get('state') == 'SUCCEEDED'):
                raise SubsequenceTimeoutError

            transcript = self.append_operations_response(operation, *args)
        else:
            print(f'--couldn\'t find key {cache_key}')
            (results, amount) = self.begin_async_google_operation(*args)
            print(results.operation)
            cache.set(cache_key, results.operation.name, GOOGLE_CACHE_TIMEOUT)
            print(cache.get(cache_key))
            self.update_counters(amount)

            try:
                result = results.result(timeout=REQUEST_TIMEOUT)
            except TimeoutError as err:
                raise SubsequenceTimeoutError from err
            transcript = self.append_api_response(result, *args)

        cache.delete(cache_key)
        return transcript


class AutoTranscription:
    """
    The engine for transcribing audio files
    """
    def store_transcript(self, transcript, asset, submission_id):
        pass


class GoogleTranscribeEngine(AutoTranscription, GoogleTransXEngine):
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
