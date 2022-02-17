# coding: utf-8
from google.cloud import speech_v1
from google.cloud import storage

from kpi.models.asset import Asset


class AutoTranscription:
    """
    The engine for transcribing audio files
    """
    def store_transcript(self, transcript, asset, submission_id):
        pass


class GoogleTranscribeEngine(AutoTranscription):
    def __init__(self):
        self.destination_path = None
        self.bucket_name = 'kobo-transcription-test'

    def delete_google_file(self):
        """
        Files need to be deleted from google storage after
        the transcript finished to avoid running up the bill
        """
        storage_client = storage.Client()
        bucket = storage_client.bucket(self.bucket_name)
        blob = bucket.blob(self.destination_path)
        blob.delete()

    def get_converted_audio(
            self,
            asset,
            xpath: str,
            submission_id: int,
            user: object
    ):
        attachment = asset.deployment.get_attachment(submission_id, user, xpath=xpath)
        attachment_path = attachment.absolute_flac_path
        filepath = attachment.media_file.name
        return attachment_path, filepath

    def store_file(self, attachment_path: str, filename: str):
        self.destination_path = f"{filename}.flac"

        # send the audio file to google storage
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name=self.bucket_name)
        destination = bucket.blob(self.destination_path)
        destination.upload_from_filename(
            attachment_path,
            content_type='audio/flac',
        )
        return self.destination_path

    def transcribe_file(
            self,
            asset,
            xpath: str,
            submission_id: int,
            source: str,
            user: object,
    ):
        # get the audio file in a Google supported format
        path, filename = self.get_converted_audio(
            xpath=xpath,
            asset=asset,
            submission_id=submission_id,
            user=user
        )

        # Make sure the file is stored in Google storage or long
        # files won't run
        gcs_path = self.store_file(path, filename)

        # Create the parameters required for the transcription
        speech_client = speech_v1.SpeechClient()
        audio = speech_v1.RecognitionAudio(uri=f'gs://{self.bucket_name}/{gcs_path}')
        config = speech_v1.RecognitionConfig(
            encoding=speech_v1.RecognitionConfig.AudioEncoding.FLAC,
            language_code=source,
            audio_channel_count=2,
            enable_automatic_punctuation=True,
        )

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
        self.delete_google_file()

        return transcript
