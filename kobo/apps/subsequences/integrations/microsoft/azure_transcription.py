# coding: utf-8
import os

from azure.cognitiveservices import speech

from kobo.apps.subsequences.integrations.google.google_transcribe import AutoTranscription


class AzureTranscription(AutoTranscription):

    def __init__(self):
        self.api_key = os.environ['AZURE_TRANSCRIPTION_API_KEY']
        self.region = os.environ['AZURE_REGION']

    def transcribe(self, source_language: str, filename: str):
        speech_config = speech.SpeechConfig(
            subscription=self.api_key,
            region=self.region
        )
        audio_config = speech.AudioConfig(filename=filename)

        speech_recognizer = speech.SpeechRecognizer(
            speech_config=speech_config,
            audio_config=audio_config,
            language=source_language,
        )

        speech_result = speech_recognizer.recognize_once_async()

        results = speech_result.get()

        return results.text
