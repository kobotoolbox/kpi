import json
from unittest.mock import MagicMock, patch

import responses
from ddt import data, ddt
from django.test import TestCase, override_settings

from kobo.apps.languages.models.language import Language
from kobo.apps.subsequences.actions.automatic_google_translation import (
    AutomaticGoogleTranslationAction,
)
from kobo.apps.subsequences.integrations.google.google_translate import (
    GoogleTranslationService,
)
from kobo.apps.subsequences.integrations.local.local_translate import (
    LocalTranslationService,
)
from kpi.models import Asset

LLM_URL = 'http://llm:8080/v1/chat/completions'


def llm_reply(content):
    return {'choices': [{'message': {'role': 'assistant', 'content': content}}]}


@ddt
@override_settings(NLP_BACKEND='local', LOCAL_LLM_URL='http://llm:8080')
class TestLocalTranslate(TestCase):
    fixtures = ['test_data']

    def setUp(self):
        self.asset = Asset.objects.get(pk=2)
        self.submission = {
            '_uuid': '2bb75d6b-45f5-48ac-9472-38d7246c84f7',
            'meta/rootUuid': 'uuid:2bb75d6b-45f5-48ac-9472-38d7246c84f7',
        }
        Language.objects.get_or_create(code='es', defaults={'name': 'Spanish'})
        Language.objects.get_or_create(code='en', defaults={'name': 'English'})
        self.service = LocalTranslationService(self.submission, self.asset)

    def _sent_prompt(self):
        body = json.loads(responses.calls[0].request.body)
        return body, body['messages'][0]['content']

    @responses.activate
    def test_translates_a_transcript(self):
        responses.post(LLM_URL, json=llm_reply('  The road is blocked.\n'))

        result = self.service.process_data(
            'audio',
            {
                'language': 'en',
                '_dependency': {
                    'language': 'es',
                    'value': 'La carretera está cortada.',
                },
            },
        )

        assert result == {'status': 'complete', 'value': 'The road is blocked.'}
        body, prompt = self._sent_prompt()
        assert 'from Spanish into English' in prompt
        assert prompt.endswith('La carretera está cortada.')
        assert body['temperature'] == 0

    @responses.activate
    def test_text_source_uses_the_form_language_as_a_hint(self):
        responses.post(LLM_URL, json=llm_reply('Hola'))
        self.asset.content = {'settings': {'default_language': 'English (en)'}}
        self.asset._survey_metadata = None
        self.submission['q1'] = 'Hello'

        result = self.service.process_data(
            'q1', {'language': 'es', '_dependency': {'_actionId': 'submission'}}
        )

        assert result == {'status': 'complete', 'value': 'Hola'}
        _, prompt = self._sent_prompt()
        assert 'from English into Spanish' in prompt

    @responses.activate
    def test_text_source_without_form_language_lets_the_model_detect_it(self):
        responses.post(LLM_URL, json=llm_reply('Hola'))
        self.asset.content = {'settings': {}, 'translations': [None]}
        self.asset._survey_metadata = None
        self.submission['q1'] = 'Hello'

        self.service.process_data(
            'q1', {'language': 'es', '_dependency': {'_actionId': 'submission'}}
        )

        _, prompt = self._sent_prompt()
        assert 'below into Spanish' in prompt

    @responses.activate
    def test_unknown_language_code_is_passed_through(self):
        responses.post(LLM_URL, json=llm_reply('Hello'))

        self.service.process_data(
            'audio',
            {'language': 'en', '_dependency': {'language': 'xyz', 'value': 'Mbote'}},
        )

        _, prompt = self._sent_prompt()
        assert 'from xyz into English' in prompt

    def test_no_text_fails_without_calling_the_llm(self):
        result = self.service.process_data(
            'q1', {'language': 'es', '_dependency': {'_actionId': 'submission'}}
        )

        assert result['status'] == 'failed'
        assert 'no text' in result['error']

    @override_settings(CELERY_TASK_ALWAYS_EAGER=False)
    @responses.activate
    def test_defers_to_celery_outside_a_worker(self):
        with patch(
            'kobo.apps.subsequences.integrations.local.client.celery_app',
            MagicMock(current_worker_task=None),
        ):
            result = self.service.process_data(
                'audio',
                {'language': 'en', '_dependency': {'language': 'es', 'value': 'Hola'}},
            )

        assert result == {'status': 'in_progress'}
        assert len(responses.calls) == 0

    @override_settings(CELERY_TASK_ALWAYS_EAGER=False)
    @responses.activate
    def test_translates_inside_a_worker(self):
        responses.post(LLM_URL, json=llm_reply('Hello'))
        with patch(
            'kobo.apps.subsequences.integrations.local.client.celery_app',
            MagicMock(current_worker_task=MagicMock()),
        ):
            result = self.service.process_data(
                'audio',
                {'language': 'en', '_dependency': {'language': 'es', 'value': 'Hola'}},
            )

        assert result == {'status': 'complete', 'value': 'Hello'}

    @data(
        # response kwargs for the local server
        {'status': 500, 'json': {'error': 'model not loaded'}},
        {'json': {'choices': []}},
        {'json': llm_reply(None)},
        {'json': llm_reply('   ')},
        {'body': 'not json'},
    )
    @responses.activate
    def test_llm_errors_fail_cleanly(self, response_kwargs):
        responses.post(LLM_URL, **response_kwargs)

        result = self.service.process_data(
            'audio',
            {'language': 'en', '_dependency': {'language': 'es', 'value': 'Hola'}},
        )

        assert result['status'] == 'failed'
        assert result['error'].startswith('Translation failed')


class TestTranslationServiceSelection(TestCase):
    def _action(self):
        return AutomaticGoogleTranslationAction('q1', [{'language': 'en'}])

    @override_settings(NLP_BACKEND='local')
    def test_local_backend_uses_the_local_service(self):
        assert self._action().get_nlp_service_class() is LocalTranslationService

    def test_default_backend_uses_google(self):
        assert self._action().get_nlp_service_class() is GoogleTranslationService
