import uuid
from datetime import timedelta
from unittest.mock import patch

import jsonschema
import pytest
from ddt import data, ddt, unpack
from django.utils import timezone
from rest_framework import status
from rest_framework.reverse import reverse

from kobo.apps.subsequences.actions.automatic_bedrock_qual import (
    AutomaticBedrockQual,
)
from kobo.apps.subsequences.constants import (
    QUESTION_TYPE_INTEGER,
    QUESTION_TYPE_SELECT_MULTIPLE,
    QUESTION_TYPE_SELECT_ONE,
    QUESTION_TYPE_TEXT,
    Action,
)
from kobo.apps.subsequences.models import QuestionAdvancedFeature
from kobo.apps.subsequences.prompts import (
    PROMPTS_BY_QUESTION_TYPE,
    InvalidResponseFromLLMException,
    analysis_question_placeholder,
    choices_list_placeholder,
    example_format_placeholder,
    num_choice_placeholder,
    response_placeholder,
)
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase

valid_external_data = []


@ddt
class BaseAutomaticBedrockQualTestCase(BaseTestCase):
    fixtures = ['test_data', 'asset_with_settings_and_qa']

    def setUp(self):
        action_params = [
            {
                'type': 'qualInteger',
                'uuid': 'uuid-qual-integer',
                'labels': {'_default': 'How many characters appear in the story?'},
            },
            {
                'type': 'qualSelectMultiple',
                'uuid': 'uuid-qual-select-multiple',
                'labels': {'_default': 'What themes were present in the story?'},
                'choices': [
                    {
                        'uuid': 'uuid-empathy',
                        'labels': {'_default': 'Empathy'},
                    },
                    {
                        'uuid': 'uuid-apathy',
                        'labels': {'_default': 'Apathy'},
                    },
                ],
            },
            {
                'type': 'qualSelectOne',
                'uuid': 'uuid-qual-select-one',
                'labels': {'_default': 'Was this a first-hand account?'},
                'choices': [
                    {
                        'uuid': 'uuid-yes',
                        'labels': {'_default': 'Yes'},
                    },
                    {
                        'uuid': 'uuid-no',
                        'labels': {'_default': 'No'},
                    },
                ],
            },
            {
                'type': 'qualText',
                'uuid': 'uuid-qual-text',
                'labels': {'_default': 'Add any further remarks'},
            },
        ]
        self.asset = Asset.objects.get(uid='aNp9yMt4zKpUtTeZUnozYG')
        self.feature = QuestionAdvancedFeature.objects.create(
            asset=self.asset,
            action=Action.AUTOMATIC_BEDROCK_QUAL,
            params=action_params,
            question_xpath='q1',
        )
        self.feature.save()
        self.action = self.feature.to_action()

    def _add_submission(self):
        # add a submission
        u = self.asset.owner
        self.client.force_login(u)
        self.asset.save()
        self.asset.deploy(backend='mock', active=True)
        uuid_ = uuid.uuid4()
        submission_uuid = str(uuid_)
        submission_data = {
            'q1': 'answer',
            '_uuid': submission_uuid,
            '_submitted_by': 'someuser',
        }

        self.asset.deployment.mock_submissions([submission_data])
        return submission_uuid

    def _add_manual_transcription(self, submission_uuid) -> dict:
        # enable transcription
        QuestionAdvancedFeature.objects.create(
            question_xpath='q1',
            asset=self.asset,
            action=Action.MANUAL_TRANSCRIPTION,
            params=[{'language': 'en'}],
        )
        # add a transcription
        supplement_details_url = reverse(
            'api_v2:submission-supplement',
            args=[self.asset.uid, submission_uuid],
        )

        payload = {
            '_version': '20250820',
            'q1': {
                Action.MANUAL_TRANSCRIPTION: {
                    'language': 'en',
                    'value': 'This is a transcript.',
                },
            },
        }
        response = self.client.patch(
            supplement_details_url, data=payload, format='json'
        )
        transcript = response.data['q1'][Action.MANUAL_TRANSCRIPTION]['_versions'][0]
        return transcript


@ddt
class TestBedrockAutomaticChainedQual(BaseAutomaticBedrockQualTestCase):

    @data(
        # type, main label, choice label, should pass?
        ('qualInteger', 'How many?', None, True),
        ('qualInteger', 'How many?', 'This should not be here', False),
        ('qualInteger', None, None, False),
        ('qualText', 'Why?', None, True),
        ('qualText', 'Why?', 'This should not be here', False),
        ('qualText', None, None, False),
        ('qualSelectOne', 'Select one', None, False),
        ('qualSelectOne', 'Select one', 'Choice A', True),
        ('qualSelectOne', None, 'Choice A', False),
        ('qualSelectMultiple', 'Select many', None, False),
        ('qualSelectMultiple', 'Select many', 'Choice A', True),
        ('qualSelectMultiple', None, 'Choice A', False),
        # notes and tags not allowed in automatic QA
        ('qualNote', 'Note', None, False),
        ('qualTags', 'Tag', None, False),
        ('badType', 'label', None, False),
        (None, 'label', None, False),
    )
    @unpack
    def test_valid_params(self, question_type, main_label, choice_label, should_pass):
        main_uuid = 'main_uuid'
        choice_uuid = 'choice_uuid'
        param = {'uuid': main_uuid}
        if question_type:
            param['type'] = question_type
        if main_label:
            param['labels'] = {'_default': main_label}
        if choice_label:
            param['choices'] = [
                {'uuid': choice_uuid, 'labels': {'_default': choice_label}}
            ]
        if should_pass:
            AutomaticBedrockQual.validate_params([param])
        else:
            with pytest.raises(jsonschema.exceptions.ValidationError):
                AutomaticBedrockQual.validate_params([param])

    def test_valid_user_data(self):
        for param in self.feature.params:
            if param['type'] == 'qualNote':
                continue
            uuid = param['uuid']
            self.action.validate_data({'uuid': uuid})

    def test_invalid_user_data_no_uuid(self):
        with pytest.raises(jsonschema.exceptions.ValidationError):
            self.action.validate_data({})

    def test_invalid_user_data_extra_field(self):
        with pytest.raises(jsonschema.exceptions.ValidationError):
            self.action.validate_data({'uuid': 'uuid-qual-text', 'other': 'stuff'})

    def test_invalid_user_data_type_note(self):
        with pytest.raises(jsonschema.exceptions.ValidationError):
            self.action.validate_data({'uuid': 'uuid-qual-note'})

    # uuid, value, status, error, good
    @data(
        ('uuid-qual-text', 'Hi', 'complete', None, True),
        ('uuid-qual-text', '', 'complete', None, True),
        ('uuid-qual-text', None, 'complete', None, False),
        ('uuid-qual-text', None, 'failed', 'error', True),
        ('uuid-qual-text', None, 'failed', None, False),
        ('uuid-qual-text', 'Hi', 'failed', 'error', False),
        ('uuid-qual-integer', 1, 'complete', None, True),
        ('uuid-qual-integer', 0, 'complete', None, True),
        ('uuid-qual-integer', None, 'failed', 'error', True),
        ('uuid-qual-integer', 1, 'failed', 'error', False),
        ('uuid-qual-select-one', 'uuid-yes', 'complete', None, True),
        ('uuid-qual-select-one', '', 'complete', None, True),
        ('uuid-qual-select-one', None, 'complete', None, False),
        ('uuid-qual-select-one', 'uuid-bad', 'complete', None, False),
        ('uuid-qual-select-one', None, 'failed', 'error', True),
        ('uuid-qual-select-one', 'uuid-yes', 'failed', 'error', False),
        ('uuid-qual-select-multiple', ['uuid-empathy'], 'complete', None, True),
        ('uuid-qual-select-multiple', [], 'complete', None, True),
        ('uuid-qual-select-multiple', None, 'complete', None, False),
        ('uuid-qual-select-multiple', ['uuid-bad'], 'complete', None, False),
        ('uuid-qual-select-multiple', None, 'failed', 'error', True),
        ('uuid-qual-select-multiple', ['uuid-empathy'], 'failed', 'error', False),
    )
    @unpack
    def test_valid_external_data(self, uuid, value, status, error, accept):
        data = {'uuid': uuid, 'status': status}
        if value is not None:
            data['value'] = value
        if error:
            data['error'] = error
        if accept:
            self.action.validate_external_data(data)
        else:
            with pytest.raises(jsonschema.exceptions.ValidationError):
                self.action.validate_external_data(data)

    def test_update_supplement_api(self):
        sub_uuid = self._add_submission()
        transcript_dict = self._add_manual_transcription(sub_uuid)
        supplement_details_url = reverse(
            'api_v2:submission-supplement',
            args=[self.asset.uid, sub_uuid],
        )

        payload = {
            '_version': '20250820',
            'q1': {
                Action.AUTOMATIC_BEDROCK_QUAL: {
                    'uuid': 'uuid-qual-text',
                },
            },
        }
        return_val = {'value': 'LLM text', 'status': 'complete'}
        with patch.object(
            AutomaticBedrockQual, 'run_external_process', return_value=return_val
        ):
            response = self.client.patch(
                supplement_details_url, data=payload, format='json'
            )
        assert response.status_code == status.HTTP_200_OK
        transcript_uuid = transcript_dict['_uuid']
        version = response.data['q1'][Action.AUTOMATIC_BEDROCK_QUAL]['uuid-qual-text'][
            '_versions'
        ][0]
        version_data = version['_data']
        assert version_data['value'] == 'LLM text'
        assert version_data['status'] == 'complete'
        assert version['_dependency']['_uuid'] == transcript_uuid
        assert version['_dependency']['_actionId'] == Action.MANUAL_TRANSCRIPTION

    def test_transform_data_filters_out_failed_versions(self):
        today = timezone.now()
        yesterday = today - timedelta(days=1)
        action_data = {
            'uuid-qual-text': {
                '_versions': [
                    {
                        '_data': {
                            'uuid': 'uuid-qual-text',
                            'status': 'failed',
                            'error': 'Something went wrong',
                        },
                        '_dateCreated': today.isoformat(),
                        '_uuid': 'v2',
                    },
                    {
                        '_data': {'uuid': 'uuid-qual-text', 'value': 'Initial note'},
                        '_dateCreated': yesterday.isoformat(),
                        '_dateAccepted': yesterday.isoformat(),
                        '_uuid': 'v1',
                    },
                ],
                '_dateCreated': yesterday.isoformat(),
                '_dateModified': today.isoformat(),
            }
        }

        output = self.action.transform_data_for_output(action_data)
        assert len(output.keys()) == 1

        text_item = output.get(('qual', 'uuid-qual-text'))
        # take the initial note because the most recent request to overwrite failed
        assert text_item['value'] == 'Initial note'
        assert 'error' not in text_item


@ddt
class TestAutomaticBedrockQualExternalProcess(BaseAutomaticBedrockQualTestCase):

    def setUp(self):
        super().setUp()
        self.submission_uuid = self._add_submission()
        self.transcript_dict = self._add_manual_transcription(self.submission_uuid)

    def _dependency_dict_from_transcript_dict(self):
        return {
            '_uuid': self.transcript_dict['_uuid'],
            'value': self.transcript_dict['_data']['value'],
            'language': self.transcript_dict['_data']['language'],
            '_actionId': Action.MANUAL_TRANSCRIPTION,
        }

    def _get_question(self, uuid):
        question = [q for q in self.action.params if q['uuid'] == uuid]
        return question[0]

    def _get_question_text_by_uuid(self, uuid):
        question = self._get_question(uuid)
        return question['labels']['_default']

    @data('uuid-qual-text', 'uuid-qual-integer')
    def test_generate_llm_prompt_without_choices(self, qa_question_uuid):
        mock_templates_by_type = {
            QUESTION_TYPE_INTEGER: f'integer transcript: {response_placeholder},'
            f' qa question: {analysis_question_placeholder}',
            QUESTION_TYPE_TEXT: f'text transcript: {response_placeholder},'
            f' qa question: {analysis_question_placeholder}',
        }
        transcript_text = self.transcript_dict['_data']['value']
        action_data = {
            'uuid': qa_question_uuid,
            '_dependency': self._dependency_dict_from_transcript_dict(),
        }
        with patch.dict(PROMPTS_BY_QUESTION_TYPE, mock_templates_by_type):
            prompt = self.action.generate_llm_prompt(action_data)
        short_type = qa_question_uuid.split('-')[-1]
        question_text = self._get_question_text_by_uuid(qa_question_uuid)
        expected = (
            f'{short_type} transcript: {transcript_text},'
            f' qa question: {question_text}'
        )
        assert prompt == expected

    @data('uuid-qual-select-one', 'uuid-qual-select-multiple')
    def test_generate_llm_prompt_with_choices(self, qa_question_uuid):
        mock_templates_by_type = {
            QUESTION_TYPE_SELECT_ONE: f'one transcript: {response_placeholder},'
            f' qa question: {analysis_question_placeholder},'
            f' choices: {choices_list_placeholder},'
            f' count: {num_choice_placeholder},'
            f' format: {example_format_placeholder}',
            QUESTION_TYPE_SELECT_MULTIPLE: f'multiple'
            f' transcript: {response_placeholder},'
            f' qa question: {analysis_question_placeholder},'
            f' choices: {choices_list_placeholder},'
            f' count: {num_choice_placeholder},'
            f' format: {example_format_placeholder}',
        }
        transcript_text = self.transcript_dict['_data']['value']
        action_data = {
            'uuid': qa_question_uuid,
            '_dependency': self._dependency_dict_from_transcript_dict(),
        }
        question = self._get_question(qa_question_uuid)
        question_text = self._get_question_text_by_uuid(qa_question_uuid)
        qa_choices = question['choices']
        choices_labels = [choice['labels']['_default'] for choice in qa_choices]
        choice_count = len(qa_choices)
        with patch.dict(PROMPTS_BY_QUESTION_TYPE, mock_templates_by_type):
            with patch(
                'kobo.apps.subsequences.actions.automatic_bedrock_qual.format_choices',
                lambda choices: ','.join(choices),
            ):
                with patch(
                    'kobo.apps.subsequences.actions.automatic_bedrock_qual.get_example_format',  # noqa
                    return_value='example format string',
                ):
                    prompt = self.action.generate_llm_prompt(action_data)
        short_type = qa_question_uuid.split('-')[-1]
        expected_choices_string = ','.join(choices_labels)
        assert prompt == (
            f'{short_type} transcript: {transcript_text},'
            f' qa question: {question_text},'
            f' choices: {expected_choices_string},'
            f' count: {choice_count},'
            f' format: example format string'
        )

    @data(
        # question uuid, parsing method name
        ('uuid-qual-text', 'parse_text_response'),
        ('uuid-qual-select-one', 'parse_choices_response'),
        ('uuid-qual-select-multiple', 'parse_choices_response'),
        ('uuid-qual-integer', 'parse_integer_response'),
    )
    @unpack
    def test_errors_from_external_process(self, question_uuid, method_to_patch):
        action_data = {
            'uuid': question_uuid,
            '_dependency': self._dependency_dict_from_transcript_dict(),
        }
        with patch.object(self.action, 'get_response_from_llm', return_value='text'):
            with patch(
                f'kobo.apps.subsequences.actions.automatic_bedrock_qual.{method_to_patch}',  # noqa
                side_effect=InvalidResponseFromLLMException('Cannot parse'),
            ):
                return_value = self.action.run_external_process(
                    {}, {}, action_data=action_data
                )
        assert return_value.get('status') == 'failed'
        assert return_value.get('error') == 'Cannot parse'

    def test_run_external_process_only_passes_visible_choices(self):
        mock_templates_by_type = {
            QUESTION_TYPE_SELECT_MULTIPLE: f'choices: {choices_list_placeholder}'
            f' count: {num_choice_placeholder}',
        }
        action_data = {
            'uuid': 'uuid-qual-select-multiple',
            '_dependency': self._dependency_dict_from_transcript_dict(),
        }
        self.feature.params[1]['choices'][0]['options'] = {'deleted': True}
        self.feature.save()
        self.action = self.feature.to_action()
        with patch.dict(PROMPTS_BY_QUESTION_TYPE, mock_templates_by_type):
            with patch(
                'kobo.apps.subsequences.actions.automatic_bedrock_qual.format_choices',
                lambda choices: ','.join(choices),
            ):
                prompt = self.action.generate_llm_prompt(action_data)
        assert prompt == 'choices: Apathy count: 1'
