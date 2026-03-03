import copy
import uuid
from datetime import timedelta
from unittest.mock import ANY, DEFAULT, call, patch

import jsonschema
import pytest
from ddt import data, ddt, unpack
from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.reverse import reverse

from kobo.apps.subsequences.actions import ManualQualAction
from kobo.apps.subsequences.actions.automatic_bedrock_qual import (
    OSS120,
    AutomaticBedrockQual,
    ClaudeSonnet,
)
from kobo.apps.subsequences.constants import (
    QUESTION_TYPE_INTEGER,
    QUESTION_TYPE_SELECT_MULTIPLE,
    QUESTION_TYPE_SELECT_ONE,
    QUESTION_TYPE_TEXT,
    Action,
)
from kobo.apps.subsequences.exceptions import (
    AnalysisQuestionNotFound,
    ManualQualNotFound,
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
from kobo.apps.subsequences.tests.constants import (
    BEDROCK_CHOICE_APATHY_UUID,
    BEDROCK_CHOICE_EMPATHY_UUID,
    BEDROCK_CHOICE_NO_UUID,
    BEDROCK_CHOICE_YES_UUID,
    BEDROCK_QUAL_INTEGER_UUID,
    BEDROCK_QUAL_SELECT_MULTIPLE_UUID,
    BEDROCK_QUAL_SELECT_ONE_UUID,
    BEDROCK_QUAL_TEXT_UUID,
    BEDROCK_VALIDATION_MAIN_UUID,
)
from kobo.apps.subsequences.tests.utils import MockLLMClient
from kobo.apps.trackers.models import NLPUsageCounter
from kpi.models import Asset
from kpi.tests.base_test_case import BaseTestCase

valid_external_data = []


@ddt
class BaseAutomaticBedrockQualTestCase(BaseTestCase):
    fixtures = ['test_data', 'asset_with_settings_and_qa']

    def setUp(self):
        self.asset = Asset.objects.get(uid='aNp9yMt4zKpUtTeZUnozYG')
        self.feature = QuestionAdvancedFeature.objects.get(
            asset=self.asset,
            action=Action.AUTOMATIC_BEDROCK_QUAL,
            question_xpath='q1',
        )
        self.action = self.feature.to_action()
        patched_get_client = patch.object(
            self.action, 'create_bedrock_client', return_value=MockLLMClient('response')
        )
        patched_get_client.start()
        self.addCleanup(patched_get_client.stop)

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
class TestBedrockAutomaticBedrockQual(BaseAutomaticBedrockQualTestCase):

    @data(
        # uuid, extra, should pass
        (BEDROCK_VALIDATION_MAIN_UUID, False, True),
        ('notAUuid?!@#$', False, False),
        (BEDROCK_VALIDATION_MAIN_UUID, True, False),
    )
    @unpack
    def test_valid_params(self, q_uuid, add_extra_prop, should_pass):
        param = {'uuid': q_uuid}
        if add_extra_prop:
            param['something'] = 'else'
        if should_pass:
            AutomaticBedrockQual.validate_params([param])
        else:
            with pytest.raises(jsonschema.exceptions.ValidationError):
                AutomaticBedrockQual.validate_params([param])

    def test_create_action_fails_if_no_manual_qual(self):
        QuestionAdvancedFeature.objects.get(
            action=Action.MANUAL_QUAL, question_xpath='q1', asset=self.asset
        ).delete()
        with pytest.raises(ManualQualNotFound):
            feature = QuestionAdvancedFeature.objects.get(
                asset=self.asset,
                action=Action.AUTOMATIC_BEDROCK_QUAL,
                question_xpath='q1',
            )
            feature.to_action()

    def test_update_params(self):
        current_params = [copy.deepcopy(param) for param in self.action.params]
        new_uuid = str(uuid.uuid4())
        self.action.update_params(
            [{'uuid': BEDROCK_QUAL_TEXT_UUID}, {'uuid': new_uuid}]
        )
        assert self.action.params == [*current_params, {'uuid': new_uuid}]

    def test_valid_user_data(self):
        for param in self.action.get_question_params():
            if param['type'] == 'qualNote':
                continue
            uuid_ = param['uuid']
            self.action.validate_data({'uuid': uuid_})
            self.action.validate_data({'uuid': uuid_, 'verified': True})

    def test_invalid_user_data_no_uuid(self):
        with pytest.raises(jsonschema.exceptions.ValidationError):
            self.action.validate_data({})

    def test_invalid_user_data_extra_field(self):
        with pytest.raises(jsonschema.exceptions.ValidationError):
            self.action.validate_data(
                {'uuid': BEDROCK_QUAL_TEXT_UUID, 'other': 'stuff'}
            )

    def test_invalid_user_data_type_note(self):
        with pytest.raises(jsonschema.exceptions.ValidationError):
            self.action.validate_data({'uuid': 'uuid-qual-note'})

    # uuid, value, status, error, good
    @data(
        (BEDROCK_QUAL_TEXT_UUID, 'Hi', 'complete', None, True),
        (BEDROCK_QUAL_TEXT_UUID, '', 'complete', None, True),
        (BEDROCK_QUAL_TEXT_UUID, None, 'complete', None, False),
        (BEDROCK_QUAL_TEXT_UUID, None, 'failed', 'error', True),
        (BEDROCK_QUAL_TEXT_UUID, None, 'failed', None, False),
        (BEDROCK_QUAL_TEXT_UUID, 'Hi', 'failed', 'error', False),
        (BEDROCK_QUAL_INTEGER_UUID, 1, 'complete', None, True),
        (BEDROCK_QUAL_INTEGER_UUID, 0, 'complete', None, True),
        (BEDROCK_QUAL_INTEGER_UUID, None, 'failed', 'error', True),
        (BEDROCK_QUAL_INTEGER_UUID, 1, 'failed', 'error', False),
        (
            BEDROCK_QUAL_SELECT_ONE_UUID,
            BEDROCK_CHOICE_YES_UUID,
            'complete',
            None,
            True,
        ),
        (BEDROCK_QUAL_SELECT_ONE_UUID, '', 'complete', None, True),
        (BEDROCK_QUAL_SELECT_ONE_UUID, None, 'complete', None, False),
        (BEDROCK_QUAL_SELECT_ONE_UUID, 'uuid-bad', 'complete', None, False),
        (BEDROCK_QUAL_SELECT_ONE_UUID, None, 'failed', 'error', True),
        (
            BEDROCK_QUAL_SELECT_ONE_UUID,
            BEDROCK_CHOICE_NO_UUID,
            'failed',
            'error',
            False,
        ),
        (
            BEDROCK_QUAL_SELECT_MULTIPLE_UUID,
            [BEDROCK_CHOICE_EMPATHY_UUID],
            'complete',
            None,
            True,
        ),
        (BEDROCK_QUAL_SELECT_MULTIPLE_UUID, [], 'complete', None, True),
        (BEDROCK_QUAL_SELECT_MULTIPLE_UUID, None, 'complete', None, False),
        (BEDROCK_QUAL_SELECT_MULTIPLE_UUID, ['uuid-bad'], 'complete', None, False),
        (BEDROCK_QUAL_SELECT_MULTIPLE_UUID, None, 'failed', 'error', True),
        (
            BEDROCK_QUAL_SELECT_MULTIPLE_UUID,
            [BEDROCK_CHOICE_APATHY_UUID],
            'failed',
            'error',
            False,
        ),
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
                    'uuid': BEDROCK_QUAL_TEXT_UUID,
                },
            },
        }
        with patch(
            'kobo.apps.subsequences.actions.automatic_bedrock_qual.boto3.client',
            return_value=MockLLMClient('LLM text'),
        ):
            response = self.client.patch(
                supplement_details_url, data=payload, format='json'
            )
        assert response.status_code == status.HTTP_200_OK
        transcript_uuid = transcript_dict['_uuid']
        version = response.data['q1'][Action.AUTOMATIC_BEDROCK_QUAL][
            BEDROCK_QUAL_TEXT_UUID
        ]['_versions'][0]
        version_data = version['_data']
        assert version_data['value'] == 'LLM text'
        assert version_data['status'] == 'complete'
        assert version['_dependency']['_uuid'] == transcript_uuid
        assert version['_dependency']['_actionId'] == Action.MANUAL_TRANSCRIPTION
        assert 'verified' in version
        assert not version['verified']
        assert version.get('_dateVerified') is None

    def test_transform_data_filters_out_failed_versions(self):
        today = timezone.now()
        yesterday = today - timedelta(days=1)
        action_data = {
            BEDROCK_QUAL_TEXT_UUID: {
                '_versions': [
                    {
                        '_data': {
                            'uuid': BEDROCK_QUAL_TEXT_UUID,
                            'status': 'failed',
                            'error': 'Something went wrong',
                        },
                        '_dateCreated': today.isoformat(),
                        '_uuid': 'v2',
                    },
                    {
                        '_data': {
                            'uuid': BEDROCK_QUAL_TEXT_UUID,
                            'value': 'Initial note',
                        },
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

        text_item = output.get(('qual', BEDROCK_QUAL_TEXT_UUID))
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
        question = [q for q in self.action.get_question_params() if q['uuid'] == uuid]
        return question[0]

    def _get_question_text_by_uuid(self, uuid):
        question = self._get_question(uuid)
        return question['labels']['_default']

    @data(BEDROCK_QUAL_TEXT_UUID, BEDROCK_QUAL_INTEGER_UUID)
    def test_generate_llm_prompt_without_choices(self, qa_question_uuid):
        mock_templates_by_type = {
            QUESTION_TYPE_INTEGER: f'{BEDROCK_QUAL_INTEGER_UUID} '
            f'transcript: {response_placeholder},'
            f' qa question: {analysis_question_placeholder}',
            QUESTION_TYPE_TEXT: f'{BEDROCK_QUAL_TEXT_UUID} '
            f'transcript: {response_placeholder},'
            f' qa question: {analysis_question_placeholder}',
        }
        transcript_text = self.transcript_dict['_data']['value']
        action_data = {
            'uuid': qa_question_uuid,
            '_dependency': self._dependency_dict_from_transcript_dict(),
        }
        with patch.dict(PROMPTS_BY_QUESTION_TYPE, mock_templates_by_type):
            prompt = self.action.generate_llm_prompt(action_data)
        question_text = self._get_question_text_by_uuid(qa_question_uuid)
        expected = (
            f'{qa_question_uuid} transcript: {transcript_text},'
            f' qa question: {question_text}'
        )
        assert prompt == expected

    @data(BEDROCK_QUAL_SELECT_ONE_UUID, BEDROCK_QUAL_SELECT_MULTIPLE_UUID)
    def test_generate_llm_prompt_with_choices(self, qa_question_uuid):
        mock_templates_by_type = {
            QUESTION_TYPE_SELECT_ONE: f'{BEDROCK_QUAL_SELECT_ONE_UUID}'
            f' transcript: {response_placeholder},'
            f' qa question: {analysis_question_placeholder},'
            f' choices: {choices_list_placeholder},'
            f' count: {num_choice_placeholder},'
            f' format: {example_format_placeholder}',
            QUESTION_TYPE_SELECT_MULTIPLE: f'{BEDROCK_QUAL_SELECT_MULTIPLE_UUID}'
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
        expected_choices_string = ','.join(choices_labels)
        assert prompt == (
            f'{qa_question_uuid} transcript: {transcript_text},'
            f' qa question: {question_text},'
            f' choices: {expected_choices_string},'
            f' count: {choice_count},'
            f' format: example format string'
        )

    def test_generate_prompt_fails_if_no_manual_question(self):
        random_uuid = str(uuid.uuid4())
        self.action.params = [{'uuid': random_uuid}]
        action_data = {
            'uuid': random_uuid,
            '_dependency': self._dependency_dict_from_transcript_dict(),
        }
        with pytest.raises(AnalysisQuestionNotFound):
            self.action.generate_llm_prompt(action_data)

    @data(
        # question uuid, parsing method name
        (BEDROCK_QUAL_TEXT_UUID, 'parse_text_response'),
        (BEDROCK_QUAL_SELECT_ONE_UUID, 'parse_choices_response'),
        (BEDROCK_QUAL_SELECT_MULTIPLE_UUID, 'parse_choices_response'),
        (BEDROCK_QUAL_INTEGER_UUID, 'parse_integer_response'),
    )
    @unpack
    def test_errors_from_external_process(self, question_uuid, method_to_patch):
        action_data = {
            'uuid': question_uuid,
            '_dependency': self._dependency_dict_from_transcript_dict(),
        }
        with patch(
            f'kobo.apps.subsequences.actions.automatic_bedrock_qual.{method_to_patch}',
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
            'uuid': BEDROCK_QUAL_SELECT_MULTIPLE_UUID,
            '_dependency': self._dependency_dict_from_transcript_dict(),
        }
        action_params = self.action._action_dependencies['params'][ManualQualAction.ID]
        action_params[1]['choices'][0]['options'] = {'deleted': True}

        with patch.dict(PROMPTS_BY_QUESTION_TYPE, mock_templates_by_type):
            with patch(
                'kobo.apps.subsequences.actions.automatic_bedrock_qual.format_choices',
                lambda choices: ','.join(choices),
            ):
                prompt = self.action.generate_llm_prompt(action_data)
        assert prompt == 'choices: Apathy count: 1'

    def test_run_external_process_does_not_call_default_if_primary_succeeds(self):
        action_data = {
            'uuid': BEDROCK_QUAL_TEXT_UUID,
            '_dependency': self._dependency_dict_from_transcript_dict(),
        }
        with patch.object(
            self.action, 'get_response_from_llm', return_value='response'
        ) as patched_get_response_from_llm:
            self.action.run_external_process({}, {}, action_data=action_data)
        patched_get_response_from_llm.assert_called_once()
        assert (
            patched_get_response_from_llm.call_args.args[1].model_id == OSS120.model_id
        )

    def test_run_external_process_calls_default_if_primary_fails(self):
        action_data = {
            'uuid': BEDROCK_QUAL_TEXT_UUID,
            '_dependency': self._dependency_dict_from_transcript_dict(),
        }
        with patch.object(
            self.action, 'get_response_from_llm', return_value='response'
        ) as patched_get_response_from_llm:
            with patch(
                f'kobo.apps.subsequences.actions.automatic_bedrock_qual.parse_text_response',  # noqa
                # first call errors, second call succeeds
                side_effect=[
                    InvalidResponseFromLLMException('Cannot parse'),
                    DEFAULT,
                ],
            ):
                self.action.run_external_process({}, {}, action_data=action_data)
        # make sure get_response_from_llm was called twice with
        # the two different models in the correct order
        patched_get_response_from_llm.assert_has_calls(
            [call(ANY, OSS120), call(ANY, ClaudeSonnet)], any_order=False
        )
        assert len(patched_get_response_from_llm.call_args) == 2

    @pytest.mark.skipif(
        not settings.STRIPE_ENABLED, reason='Requires stripe functionality'
    )
    def test_run_external_process_updates_llm_usage(self):
        today = timezone.now().date()
        current_counters = NLPUsageCounter.objects.filter(
            user=self.asset.owner, asset=self.asset, date=today
        )
        assert current_counters.count() == 0
        action_data = {
            'uuid': BEDROCK_QUAL_TEXT_UUID,
            '_dependency': self._dependency_dict_from_transcript_dict(),
        }
        with patch.object(
            self.action, 'get_response_from_llm', return_value='response'
        ):
            self.action.run_external_process({}, {}, action_data=action_data)
        today = timezone.now().date()
        counter = NLPUsageCounter.objects.get(
            user=self.asset.owner, asset=self.asset, date=today
        )
        assert counter.counters['bedrock_llm_requests'] == 1
