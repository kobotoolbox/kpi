import json
from copy import deepcopy
from dataclasses import dataclass
from json import JSONDecodeError
from typing import Optional

import boto3
from django.conf import settings
from django.utils.functional import classproperty
from django_userforeignkey.request import get_current_request

from kobo.apps.organizations.constants import UsageType
from kobo.apps.subsequences.actions.base import ActionClassConfig, ReviewType
from kobo.apps.subsequences.actions.mixins import RequiresTranscriptionMixin
from kobo.apps.subsequences.actions.qual import BaseQualAction
from kobo.apps.subsequences.constants import (
    QUESTION_TYPE_INTEGER,
    QUESTION_TYPE_NOTE,
    QUESTION_TYPE_TAGS,
    QUESTION_TYPE_TEXT,
    SELECT_QUESTIONS,
)
from kobo.apps.subsequences.exceptions import (
    AnalysisQuestionNotFound,
    ManualQualNotFound,
)
from kobo.apps.subsequences.prompts import (
    MAX_TOKENS,
    MODEL_TEMPERATURE,
    PROMPTS_BY_QUESTION_TYPE,
    InvalidResponseFromLLMException,
    analysis_question_placeholder,
    choices_list_placeholder,
    example_format_placeholder,
    format_choices,
    get_example_format,
    num_choice_placeholder,
    parse_choices_response,
    parse_integer_response,
    parse_text_response,
    response_placeholder,
)
from kobo.apps.trackers.utils import update_nlp_counter
from kpi.utils.log import logging


@dataclass
class LLModel:
    model_id: str
    path_to_response: str
    path_to_input_tokens: str
    path_to_output_tokens: str
    supports_reasoning: bool

    def __repr__(self):
        return self.model_id

    @staticmethod
    def traverse_path(path_str: str, response_dict: dict) -> str:
        path = path_str.split('.')
        current_level = response_dict
        for path_component in path:
            if path_component.isdigit():
                current_level = current_level[int(path_component)]
            else:
                current_level = current_level[path_component]
        return current_level

    def get_input_tokens(self, response_dict):
        return self.traverse_path(self.path_to_input_tokens, response_dict)

    def get_output_tokens(self, response_dict):
        return self.traverse_path(self.path_to_output_tokens, response_dict)

    def get_response_text(self, response_dict):
        return self.traverse_path(self.path_to_response, response_dict)


ClaudeSonnet = LLModel(
    model_id='anthropic.claude-3-5-sonnet-20240620-v1:0',
    path_to_response='content.0.text',
    supports_reasoning=False,
    path_to_input_tokens='usage.input_tokens',
    path_to_output_tokens='usage.output_tokens',
)
OSS120 = LLModel(
    model_id='openai.gpt-oss-safeguard-120b',
    path_to_response='choices.0.message.content',
    supports_reasoning=True,
    path_to_input_tokens='usage.prompt_tokens',
    path_to_output_tokens='usage.completion_tokens',
)


class AutomaticBedrockQual(RequiresTranscriptionMixin, BaseQualAction):

    ID = 'automatic_bedrock_qual'
    action_class_config = ActionClassConfig(
        allow_multiple=True,
        automatic=True,
        action_data_key='uuid',
        review_type=ReviewType.VERIFICATION,
    )

    def __init__(
        self,
        source_question_xpath: str,
        params: list[dict],
        asset: Optional['kpi.models.Asset'] = None,
        prefetched_dependencies: dict = None,
    ):
        super().__init__(source_question_xpath, params, asset, prefetched_dependencies)
        self.set_question_params_if_necessary()

    @property
    def _limit_identifier(self):
        return UsageType.LLM_REQUESTS

    def _get_question(self, uuid: str) -> dict:
        qa_question = [q for q in self.get_question_params() if q['uuid'] == uuid]
        if len(qa_question) == 0:
            raise AnalysisQuestionNotFound
        return qa_question[0]

    def _get_visible_choices(self, question: dict) -> list[dict]:
        return [
            choice
            for choice in question['choices']
            if not choice.get('options', {}).get('deleted')
        ]

    def create_bedrock_client(self):
        return boto3.client(
            service_name='bedrock-runtime',
            region_name=settings.AWS_BEDROCK_REGION_NAME,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )

    @property
    def data_schema(self):
        # the only data the user provides is the uuid of the question to be answered
        uuids = [q['uuid'] for q in self.params]
        return {
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                'uuid': {'$ref': '#/$defs/uuid'},
                'verified': {'type': 'boolean'},
            },
            'required': ['uuid'],
            '$defs': {
                'uuid': {'type': 'string', 'enum': uuids},
            },
        }

    @property
    def external_data_schema(self):
        # external data schema consists of the manual data schema + fields for status
        # and error
        to_return = deepcopy(super().data_schema)
        defs = to_return['$defs']
        qual_common = to_return['$defs']['qualCommon']
        del qual_common['oneOf']
        properties = qual_common['properties']
        additional_properties = {
            'status': {'$ref': '#/$defs/action_status'},
            'error': {'$ref': '#/$defs/error'},
        }
        all_props = {**properties, **additional_properties}
        to_return['$defs']['qualCommon']['properties'] = all_props
        to_return['$defs']['qualCommon']['required'] = ['uuid', 'status']

        status_defs = {
            'action_status': {
                'type': 'string',
                'enum': ['complete', 'failed'],
            },
            'error': {'type': 'string'},
            # --- Value rules ---
            # If status == "complete" → require "value" (string or null)
            'rule_value_required_when_complete': {
                'if': {
                    'required': ['status'],
                    'properties': {'status': {'const': 'complete'}},
                },
                'then': {'required': ['value']},
            },
            # If status "failed" → forbid "value"
            'rule_value_forbidden_when_failed': {
                'if': {
                    'required': ['status'],
                    'properties': {'status': {'const': 'failed'}},
                },
                'then': {'not': {'required': ['value']}},
            },
            # --- Other field rules ---
            # If status == "failed" → require "error"; else forbid it
            'rule_error_presence_when_failed': {
                'if': {
                    'required': ['status'],
                    'properties': {'status': {'const': 'failed'}},
                },
                'then': {'required': ['error']},
                'else': {'not': {'required': ['error']}},
            },
        }
        common = {
            'allOf': [
                # value is required when status == "complete"
                {'$ref': '#/$defs/rule_value_required_when_complete'},
                # value must be absent when status is "failed"
                {'$ref': '#/$defs/rule_value_forbidden_when_failed'},
                # error must be present iff status == "failed"
                {'$ref': '#/$defs/rule_error_presence_when_failed'},
            ],
        }
        to_return['$defs'] = {**defs, **status_defs}
        to_return['allOf'] = common['allOf']
        return to_return

    def set_question_params_if_necessary(self):
        from kobo.apps.subsequences.actions import ManualQualAction
        from kobo.apps.subsequences.models import QuestionAdvancedFeature

        if not self._action_dependencies.get('params', {}).get(ManualQualAction.ID):
            try:
                manual_qual = QuestionAdvancedFeature.objects.get(
                    asset=self.asset,
                    question_xpath=self.source_question_xpath,
                    action=ManualQualAction.ID,
                )
                self._action_dependencies.setdefault('params', {}).update(
                    {ManualQualAction.ID: manual_qual.params}
                )
            except QuestionAdvancedFeature.DoesNotExist:
                raise ManualQualNotFound

    def get_output_fields(self) -> list[dict]:
        return []

    def generate_llm_prompt(self, action_data: dict) -> str:
        """
        Generate the prompt that will be sent to the llm
        """
        # always need transcript, QA question text, and QA question value
        # to fill out the LLM prompt
        transcript_text = action_data['_dependency']['value']
        question_uuid = action_data['uuid']
        qa_question = self._get_question(question_uuid)
        question_text = qa_question['labels']['_default']
        question_type = qa_question['type']

        # get the correct template based on question type
        prompt_template = PROMPTS_BY_QUESTION_TYPE[question_type]

        # if it's not a select question, we only need the transcript and the question
        # text to fill out the prompt
        if question_type not in SELECT_QUESTIONS:
            return prompt_template.replace(
                response_placeholder, transcript_text
            ).replace(analysis_question_placeholder, question_text)
        else:
            # for select questions, need to get all the choices
            visible_choices = self._get_visible_choices(qa_question)
            visible_choice_labels = [
                choice['labels']['_default'] for choice in visible_choices
            ]
            choices_text = format_choices(visible_choice_labels)
            choices_count = len(visible_choices)
            example_format = get_example_format(question_type, choices_count)
            return (
                prompt_template.replace(response_placeholder, transcript_text)
                .replace(analysis_question_placeholder, question_text)
                .replace(num_choice_placeholder, str(choices_count))
                .replace(example_format_placeholder, example_format)
                .replace(choices_list_placeholder, choices_text)
            )

    def get_question_params(self):
        from kobo.apps.subsequences.actions import ManualQualAction

        return [
            param_dict
            for param_dict in self._action_dependencies['params'][ManualQualAction.ID]
            if param_dict['type'] not in [QUESTION_TYPE_NOTE, QUESTION_TYPE_TAGS]
        ]

    def get_response_from_llm(self, prompt: str, model: LLModel) -> str:
        request = {
            'anthropic_version': 'bedrock-2023-05-31',
            'max_tokens': MAX_TOKENS,
            'temperature': MODEL_TEMPERATURE,  # keep model from getting too creative
            'messages': [
                {'role': 'user', 'content': prompt},
            ],
        }

        if model.supports_reasoning:
            # invoke_model raises an error if you try to disable reasoning
            # on a model that doesn't support it in the first place
            request['include_reasoning'] = False

        response = self.client.invoke_model(
            modelId=model.model_id,
            body=json.dumps(request),
        )
        try:
            response_body = json.loads(response['body'].read())
            if request := get_current_request():
                request.llm_response = {
                    'body': response_body,
                    'model': model,
                }
            return model.get_response_text(response_body)
        except (JSONDecodeError, IndexError, KeyError) as e:
            # the response isn't in the form we expected
            if request := get_current_request():
                request.llm_response = {
                    'error': 'Unable to extract answer from LLM response object',
                }
            raise InvalidResponseFromLLMException(
                'Unable to extract answer from LLM response object'
            ) from e

    @classproperty
    def params_schema(cls):
        return {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {'uuid': {'type': 'string', 'format': 'uuid'}},
                'additionalProperties': False,
                'required': ['uuid'],
            },
        }

    @property
    def result_schema(self):
        data_schema = deepcopy(self.external_data_schema)
        data_schema_defs = data_schema.pop('$defs')
        data_schema.pop('$schema')  # discard this prior to nesting

        schema = {
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                # Every question gets a property in the results
                qual_item['uuid']: {'$ref': '#/$defs/dataActionKey'}
                for qual_item in self.params
            },
            '$defs': {
                'dataActionKey': {
                    'type': 'object',
                    'additionalProperties': False,
                    'properties': {
                        '_versions': {
                            'type': 'array',
                            'minItems': 1,
                            'items': {
                                'type': 'object',
                                'additionalProperties': False,
                                'properties': {
                                    '_data': {'$ref': '#/$defs/dataSchema'},
                                    '_dateCreated': {'$ref': '#/$defs/dateTime'},
                                    '_dateVerified': {'$ref': '#/$defs/dateTime'},
                                    '_uuid': {'$ref': '#/$defs/uuid'},
                                    'verified': {'type': 'boolean'},
                                    self.DEPENDENCY_FIELD: {
                                        'type': 'object',
                                        'additionalProperties': False,
                                        'properties': {
                                            self.UUID_FIELD: {'$ref': '#/$defs/uuid'},
                                            self.ACTION_ID_FIELD: {'type': 'string'},
                                        },
                                        'required': [
                                            self.UUID_FIELD,
                                            self.ACTION_ID_FIELD,
                                        ],
                                    },
                                },
                                'required': [
                                    '_data',
                                    '_dateCreated',
                                    '_uuid',
                                    'verified',
                                ],
                            },
                        },
                        '_dateCreated': {'$ref': '#/$defs/dateTime'},
                        '_dateModified': {'$ref': '#/$defs/dateTime'},
                    },
                    'required': ['_dateCreated', '_dateModified'],
                },
                'dateTime': {'type': 'string', 'format': 'date-time'},
                'uuid': {'type': 'string', 'format': 'uuid'},
                'dataSchema': data_schema,
                **data_schema_defs,
            },
        }

        return schema

    def run_external_process(
        self,
        submission: dict,
        action_supplemental_data: dict,
        action_data: dict,
        *args,
        **kwargs,
    ) -> dict | bool:
        """
        Run and return results of external process
        """
        qa_question_uuid = action_data['uuid']
        qa_question = self._get_question(qa_question_uuid)
        qa_question_type = qa_question['type']
        prompt = self.generate_llm_prompt(action_data)
        error = ''
        self.client = self.create_bedrock_client()
        if settings.STRIPE_ENABLED:
            update_nlp_counter(
                'bedrock_llm_requests',
                1,
                self.asset.owner_id,
                self.asset.id,
            )
        # for now, hardcode OSS to be primary and Claude to be backup
        # eventually this will be configurable
        for index, model in enumerate([OSS120, ClaudeSonnet]):
            try:
                full_response_text = self.get_response_from_llm(prompt, model)
                logging.info(
                    f'LLM prompt: \n{prompt}\nLLM response:\n{full_response_text}'
                )
                if qa_question_type == QUESTION_TYPE_TEXT:
                    return {
                        'value': parse_text_response(full_response_text),
                        'status': 'complete',
                    }
                elif qa_question['type'] == QUESTION_TYPE_INTEGER:
                    return {
                        'value': parse_integer_response(full_response_text),
                        'status': 'complete',
                    }
                elif qa_question['type'] == 'qualSelectOne':
                    visible_choices = self._get_visible_choices(qa_question)
                    selected_indexes = parse_choices_response(
                        full_response_text, len(visible_choices), False
                    )
                    index = selected_indexes[0]
                    selected_uuid = visible_choices[index]['uuid']
                    return {'value': selected_uuid, 'status': 'complete'}
                else:
                    visible_choices = self._get_visible_choices(qa_question)

                    selected_indexes = parse_choices_response(
                        full_response_text, len(visible_choices), True
                    )
                    return {
                        'value': [visible_choices[i]['uuid'] for i in selected_indexes],
                        'status': 'complete',
                    }
            except InvalidResponseFromLLMException as e:
                if index == 0:
                    logging.warning(
                        f'Invalid response from primary llm {model}: {e}.'
                        ' Defaulting to backup.'
                    )
                error = e
                continue
        if request := get_current_request():
            request.llm_response = {'error': f'{error}'}
        return {'status': 'failed', 'error': f'{error}'}

    def update_params(self, incoming_params):
        self.validate_params(incoming_params)
        current_uuids = set([param['uuid'] for param in self.params])
        for param in incoming_params:
            if param['uuid'] not in current_uuids:
                self.params.append(param)
