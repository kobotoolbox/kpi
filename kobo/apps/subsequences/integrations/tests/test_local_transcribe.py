from unittest.mock import MagicMock, PropertyMock, patch

import responses
from ddt import data, ddt, unpack
from django.test import TestCase, override_settings

from kobo.apps.subsequences.actions.automatic_google_transcription import (
    AutomaticGoogleTranscriptionAction,
)
from kobo.apps.subsequences.integrations.google.google_transcribe import (
    GoogleTranscriptionService,
)
from kobo.apps.subsequences.integrations.local.local_transcribe import (
    LocalTranscriptionService,
)
from kpi.exceptions import (
    AttachmentNotFoundException,
    InvalidXPathException,
    NotSupportedFormatException,
    SubmissionNotFoundException,
)
from kpi.models import Asset

WHISPER_URL = 'http://whisper:8080/v1/audio/transcriptions'


@ddt
@override_settings(NLP_BACKEND='local', LOCAL_WHISPER_URL='http://whisper:8080')
class TestLocalTranscribe(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.asset = Asset.objects.get(pk=2)
        self.submission = {
            '_uuid': '2bb75d6b-45f5-48ac-9472-38d7246c84f7',
            'meta/rootUuid': 'uuid:2bb75d6b-45f5-48ac-9472-38d7246c84f7',
        }
        self.attachment = MagicMock()
        self.attachment.get_transcoded_audio.return_value = b'fLaC audio'
        self.deployment = MagicMock()
        self.deployment.get_attachment.return_value = self.attachment
        patcher = patch.object(
            Asset, 'deployment', new_callable=PropertyMock, return_value=self.deployment
        )
        patcher.start()
        self.addCleanup(patcher.stop)
        self.service = LocalTranscriptionService(self.submission, self.asset)

    @responses.activate
    def test_transcribes_the_attachment(self):
        responses.post(WHISPER_URL, json={'text': ' La carretera está cortada. '})

        result = self.service.process_data(
            'audio', {'language': 'es', 'locale': 'es-MX'}
        )

        assert result == {'status': 'complete', 'value': 'La carretera está cortada.'}
        self.deployment.get_attachment.assert_called_once_with(
            '2bb75d6b-45f5-48ac-9472-38d7246c84f7', self.asset.owner, xpath='audio'
        )
        self.attachment.get_transcoded_audio.assert_called_once_with('flac')
        body = responses.calls[0].request.body
        assert b'fLaC audio' in body
        # Whisper gets the plain language code, not the locale
        assert b'name="language"\r\n\r\nes\r\n' in body

    @override_settings(CELERY_TASK_ALWAYS_EAGER=False)
    @responses.activate
    def test_defers_to_celery_outside_a_worker(self):
        with patch(
            'kobo.apps.subsequences.integrations.local.client.celery_app',
            MagicMock(current_worker_task=None),
        ):
            result = self.service.process_data('audio', {'language': 'es'})

        assert result == {'status': 'in_progress'}
        self.deployment.get_attachment.assert_not_called()
        assert len(responses.calls) == 0

    @data(
        (SubmissionNotFoundException, 'Submission not found'),
        (AttachmentNotFoundException, 'Attachment not found'),
        (InvalidXPathException, 'Invalid question name XPath'),
        (NotSupportedFormatException, 'Unsupported format'),
    )
    @unpack
    def test_attachment_errors_fail_cleanly(self, exception, message):
        self.deployment.get_attachment.side_effect = exception

        result = self.service.process_data('audio', {'language': 'es'})

        assert result == {'status': 'failed', 'error': message}

    @data(
        # response kwargs for the local server
        {'status': 500, 'json': {'error': 'model not loaded'}},
        {'json': {'no_text': True}},
        {'json': {'text': '   '}},
        {'body': 'not json'},
    )
    @responses.activate
    def test_server_errors_fail_cleanly(self, response_kwargs):
        responses.post(WHISPER_URL, **response_kwargs)

        result = self.service.process_data('audio', {'language': 'es'})

        assert result['status'] == 'failed'
        assert result['error'].startswith('Transcription failed')


class TestTranscriptionServiceSelection(TestCase):
    def _action(self):
        return AutomaticGoogleTranscriptionAction('q1', [{'language': 'es'}])

    @override_settings(NLP_BACKEND='local')
    def test_local_backend_uses_the_local_service(self):
        assert self._action().get_nlp_service_class() is LocalTranscriptionService

    def test_default_backend_uses_google(self):
        assert self._action().get_nlp_service_class() is GoogleTranscriptionService
