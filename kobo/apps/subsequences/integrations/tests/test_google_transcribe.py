from datetime import timedelta
from unittest.mock import patch

from constance.test import override_config
from django.test import TestCase

from kobo.apps.subsequences.integrations.google.google_transcribe import (
    GoogleTranscriptionService,
)
from kpi.models import Asset


class TestGoogleTranscribe(TestCase):
    fixtures = ['test_data']

    @override_config(ASR_MT_GOOGLE_SPEECH_LOCATION='eu')
    def test_transcription_service_uses_regional_endpoint(self):
        asset = Asset.objects.get(pk=2)
        submission = {
            '_id': 13,
            'formhub/uuid': 'cdf8ecb909d04b51bac4c04f6517bd6e',
            'meta/instanceID': 'uuid:2bb75d6b-45f5-48ac-9472-38d7246c84f7',
            '_xform_id_string': asset.uid,
            '_uuid': '2bb75d6b-45f5-48ac-9472-38d7246c84f7',
            'meta/rootUuid': 'uuid:2bb75d6b-45f5-48ac-9472-38d7246c84f7',
        }

        with patch(
            'kobo.apps.subsequences.integrations.google.google_transcribe.google_credentials_from_constance_config',
            return_value={},
        ):
            with patch(
                'kobo.apps.subsequences.integrations.google.base.google_credentials_from_constance_config',
                return_value={},
            ):
                with patch(
                    'kobo.apps.subsequences.integrations.google.base.storage.Client'
                ):
                    with patch(
                        'kobo.apps.subsequences.integrations.google.google_transcribe.speech.SpeechClient'
                    ) as mock_speech_client:
                        with patch(
                            'kobo.apps.subsequences.integrations.google.google_transcribe.speech.RecognitionAudio'
                        ):
                            service = GoogleTranscriptionService(submission, asset)
                            content = (b'audio', timedelta(seconds=10))
                            service.begin_google_operation(
                                'mock_xpath', 'en-US', 'fr-FR', content
                            )

                            assert mock_speech_client.called
                            kwargs = mock_speech_client.call_args[1]
                            assert kwargs.get('client_options') is not None
                            assert (
                                kwargs['client_options'].api_endpoint
                                == 'eu-speech.googleapis.com'
                            )

    @override_config(ASR_MT_GOOGLE_SPEECH_LOCATION='global')
    def test_transcription_service_uses_global_endpoint(self):
        asset = Asset.objects.get(pk=2)
        submission = {
            '_id': 13,
            'formhub/uuid': 'cdf8ecb909d04b51bac4c04f6517bd6e',
            'meta/instanceID': 'uuid:2bb75d6b-45f5-48ac-9472-38d7246c84f7',
            '_xform_id_string': asset.uid,
            '_uuid': '2bb75d6b-45f5-48ac-9472-38d7246c84f7',
            'meta/rootUuid': 'uuid:2bb75d6b-45f5-48ac-9472-38d7246c84f7',
        }

        with patch(
            'kobo.apps.subsequences.integrations.google.google_transcribe.google_credentials_from_constance_config',
            return_value={},
        ):
            with patch(
                'kobo.apps.subsequences.integrations.google.base.google_credentials_from_constance_config',
                return_value={},
            ):
                with patch(
                    'kobo.apps.subsequences.integrations.google.base.storage.Client'
                ):
                    with patch(
                        'kobo.apps.subsequences.integrations.google.google_transcribe.speech.SpeechClient'
                    ) as mock_speech_client:
                        with patch(
                            'kobo.apps.subsequences.integrations.google.google_transcribe.speech.RecognitionAudio'
                        ):
                            service = GoogleTranscriptionService(submission, asset)
                            content = (b'audio', timedelta(seconds=10))
                            service.begin_google_operation(
                                'mock_xpath', 'en-US', 'fr-FR', content
                            )

                            assert mock_speech_client.called
                            kwargs = mock_speech_client.call_args[1]
                            assert kwargs.get('client_options') is None
