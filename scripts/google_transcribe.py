from django.contrib.auth.models import User
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
            xpath: str,
            asset_uid: str,
            submission_id: int,
            user: object
    ):
        asset = Asset.objects.get(uid=asset_uid)
        attachment = asset.deployment.get_attachment(submission_id, user, xpath=xpath)
        attachment_path = attachment.absolute_flac_path
        filepath = attachment.media_file_basename
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
            # request: object,
            asset_uid: str,
            xpath: str,
            submission_id: int,
            source: str,
            user: object,
    ):
        # get the audio file in a Google supported format
        path, filename = self.get_converted_audio(
            xpath=xpath,
            asset_uid=asset_uid,
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

        transcript = []
        speech_results = speech_client.long_running_recognize(config=config, audio=audio)
        results = speech_results.result()

        for result in results.results:
            transcript.append(result)

        # self.store_transcript(transcript)
        self.delete_google_file()
        return results


def run(*args):
    asset_uid = args[0]
    submission_id = args[1]
    xpath = args[2]
    source = args[3]
    user = User.objects.get(username=args[4])

    google = GoogleTranscribeEngine()
    transcript = google.transcribe_file(asset_uid, xpath, submission_id, source, user)
    print("Here is the transcript: ", transcript)
    return transcript

    # try:
    #     file_path = args[0]
    #     if not os.path.isfile(file_path):
    #         raise Exception('A filepath is required for arg 1')
    # except Exception:
    #     print(args, flush=True)
    #     raise Exception('A filepath and language-region pair are required')
    #
    # try:
    #     language_pair = args[1]
    # except Exception:
    #     raise Exception('A language-region pair is required for arg 2')
    #
    # transcript = GoogleTranscriptEngine(file_path, language_pair)
    # transcript.transcribe()
