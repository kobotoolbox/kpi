# coding: utf-8
import uuid
from concurrent.futures import TimeoutError

from django.conf import settings
from django.core.cache import cache

from google.cloud import speech, storage

from ...constants import GOOGLE_CACHE_TIMEOUT, make_async_cache_key
from ...exceptions import SubsequenceTimeoutError
from .utils import google_credentials_from_constance_config

GS_BUCKET_PREFIX = "speech_tmp"
REQUEST_TIMEOUT = 120 # seconds


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
        self.storage_client = storage.Client(
            credentials=google_credentials_from_constance_config()
        )
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
        return attachment.get_transcoded_audio('flac')

    def store_file(self, content):
        # Store temporary file. Needed to avoid 10mb limit.
        # https://cloud.google.com/speech-to-text/quotas#content
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
        self.asset = asset

        # get the audio file in a Google supported format
        flac_content = self.get_converted_audio(
            xpath=xpath,
            submission_id=submission_id,
            user=user
        )

        # Create the parameters required for the transcription
        speech_client = speech.SpeechClient(
            credentials=google_credentials_from_constance_config()
        )
        config = speech.RecognitionConfig(
            language_code=source,
            enable_automatic_punctuation=True,
        )

        if len(flac_content) > 10000000:  # 10mb
            # Store larger files on gcloud
            gcs_path = self.store_file(flac_content)
            audio = speech.RecognitionAudio(uri=f'gs://{settings.GS_BUCKET_NAME}/{gcs_path}')
        else:
            # Performance optimization, it's faster directly
            audio = speech.RecognitionAudio(content=flac_content)

        speech_results = speech_client.long_running_recognize(audio=audio, config=config)
        cache_key = make_async_cache_key(user.pk, submission_id, xpath, source)
        cache.set(cache_key, speech_results.operation.name, GOOGLE_CACHE_TIMEOUT)
        try:
            results = speech_results.result(timeout=REQUEST_TIMEOUT)
        except TimeoutError as err:
            raise SubsequenceTimeoutError from err
        cache.delete(cache_key)

        transcript = []
        for result in results.results:
            alternatives = result.alternatives
            transcript.append({
                'transcript': alternatives[0].transcript,
                'confidence': alternatives[0].confidence,
            })

        return transcript
