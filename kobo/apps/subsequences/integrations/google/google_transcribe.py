# coding: utf-8
import uuid
from concurrent.futures import TimeoutError

from django.core.cache import cache

from google.cloud import speech

from .utils import google_credentials_from_constance_config

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
        audio = speech.RecognitionAudio(content=flac_content)
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.FLAC,
            language_code=source,
            enable_automatic_punctuation=True,
        )

        # `long_running_recognize()` blocks until the transcription is done
        request = speech.LongRunningRecognizeRequest(audio=audio, config=config)
        speech_results = speech_client.long_running_recognize(request=request)
        try:
            results = speech_results.result(timeout=REQUEST_TIMEOUT)
        except TimeoutError as err:
            # TODO handle this
            raise err

        transcript = []
        for result in results.results:
            alternatives = result.alternatives
            transcript.append({
                'transcript': alternatives[0].transcript,
                'confidence': alternatives[0].confidence,
            })

        return transcript
