# coding: utf-8
import uuid

from google.cloud import speech_v1
from google.cloud import storage

from .utils import google_credentials_from_constance_config


BUCKET_NAME = 'kobo-transcription-test'


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
        self.bucket_name = 'kobo-transcription-test'
        self.storage_client = storage.Client(
            credentials=google_credentials_from_constance_config()
        )
        self.bucket = self.storage_client.bucket(bucket_name=BUCKET_NAME)

    def delete_google_file(self):
        """
        Files need to be deleted from google storage after
        the transcript finished to avoid running up the bill
        """
        blob = self.bucket.blob(self.destination_path)
        blob.delete()

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
        self.destination_path = (
            f'{self.asset.owner.username}/{self.asset.uid}/{uuid.uuid4()}.flac'
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

        # Make sure the file is stored in Google storage or long
        # files won't run
        gcs_path = self.store_file(flac_content)

        # Create the parameters required for the transcription
        speech_client = speech_v1.SpeechClient(
            credentials=google_credentials_from_constance_config()
        )
        audio = speech_v1.RecognitionAudio(uri=f'gs://{BUCKET_NAME}/{gcs_path}')
        config = speech_v1.RecognitionConfig(
            encoding=speech_v1.RecognitionConfig.AudioEncoding.FLAC,
            language_code=source,
            enable_automatic_punctuation=True,
        )

        # `long_running_recognize()` blocks until the transcription is done
        speech_results = speech_client.long_running_recognize(config=config, audio=audio)
        results = speech_results.result()

        transcript = []
        for result in results.results:
            alternatives = result.alternatives
            transcript.append({
                'transcript': alternatives[0].transcript,
                'confidence': alternatives[0].confidence,
            })

        # delete the audio file from storage
        # FIXME: if the transcription takes too long to generate, e.g. it
        # exceeds the uWSGI timeout, this process will be killed and the audio
        # file will never be cleaned up
        self.delete_google_file()

        return transcript
