import os
import subprocess

from google.cloud import speech_v1 as speech, storage
from moviepy import editor as mp


class TranscriptEngineBase:
    def __init__(self, audio_file, language_encoding):
        self.audio_file = audio_file
        # setting bucket here because it would probably be an env variable
        self.bucket_name = os.environ.get('GOOGLE_STORAGE_BUCKET_NAME')
        self.language_encoding = language_encoding
        self.gcs_url = ''
        self.file_ext = ''
        self.response = ''

    def check_flac_exists(self):
        file = os.path.splitext(self.audio_file)[0] + '.flac'
        if os.path.isfile(file) is True:
            self.audio_file = file
            return
        else:
            self.convert_file_type()

    def convert_file_type(self):
        converted_filename = f"{self.file_path}/{self.file_name}.flac"
        subprocess.run(['ffmpeg', '-i', self.audio_file, '-ac', '1', '-ar', '16000', converted_filename])

        self.audio_file = converted_filename
        self.file_ext = '.flac'
        return

    @property
    def file_name(self):
        # returns the file name with no extension to maintain consistency
        file = os.path.splitext(os.path.split(self.audio_file)[1])[0]
        return file

    @property
    def file_path(self):
        file_path = os.path.split(self.audio_file)[0]
        return file_path

    def file_type(self):
        # FLAC and AMR files need to be converted
        if self.file_ext != '.flac':
            self.remove_video()
            self.check_flac_exists()

    def remove_video(self):
        # Removing any video from the files reduces the time it takes to convert to flac
        # No luck in finding a library that supports exporting the audio to flac
        try:
            video_file = mp.VideoFileClip(self.audio_file)
            new_file = f"{self.file_path}/{self.file_name}.mp3"
            video_file.audio.write_audiofile(new_file)
            self.audio_file = new_file
        except KeyError:
            pass

    def store_transcript(self, gsc_response):
        # we will need to save the transcript somewhere
        # saving it in txt files for now
        transcript_file = open(
            f"kpi/tests/{self.file_name}.txt",
            "a"
        )

        for result in gsc_response.results:
            alternatives = result.alternatives
            print(alternatives[0].transcript, file=transcript_file)

        transcript_file.close()


class GoogleTranscriptEngine(TranscriptEngineBase):
    def gcs_store_file(self):
        """
        Stores the file in Google Cloud Storage to be used
        for transcription

        Returns:
             str: url for the file in google storage
        """
        destination_path = f"{self.file_name}{self.file_ext}"
        source_filename = self.audio_file
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name=self.bucket_name)
        destination = bucket.blob(destination_path)
        destination.upload_from_filename(
            source_filename,
            # Temp hardcode for debugging
            content_type=f"audio/flac",
        )

        self.gcs_url = f"gs://{self.bucket_name}/{destination_path}"
        return self.gcs_url

    def transcribe(self):
        """
        Transcribe the file using Google Speech-to-text

        :return:
            json: Response containing the transcribed text
        """
        self.file_type()
        self.gcs_store_file()
        client = speech.SpeechClient()
        audio = speech.RecognitionAudio(uri=self.gcs_url)
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.FLAC,
            sample_rate_hertz=16000,
            language_code=self.language_encoding,
            enable_automatic_punctuation=True,
        )
        response = client.long_running_recognize(
            config=config,
            audio=audio,
        )
        self.response = response

        result = response.result()
        self.store_transcript(result)
        return response


def run(*args):
    try:
        file_path = args[0]
        if not os.path.isfile(file_path):
            raise Exception('A filepath is required for arg 1')
    except Exception:
        print(args, flush=True)
        raise Exception('A filepath and language-region pair are required')

    try:
        language_pair = args[1]
    except Exception:
        raise Exception('A language-region pair is required for arg 2')

    transcript = GoogleTranscriptEngine(file_path, language_pair)
    transcript.transcribe()
