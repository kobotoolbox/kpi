import json
from copy import deepcopy
from json import JSONDecodeError

import boto3
from django.conf import settings
from django.utils.functional import classproperty

from kobo.apps.organizations.constants import UsageType
from kobo.apps.subsequences.actions.base import ActionClassConfig
from kobo.apps.subsequences.actions.mixins import RequiresTranscriptionMixin
from kobo.apps.subsequences.actions.qual import BaseQualAction
from kobo.apps.subsequences.constants import (
    QUESTION_TYPE_INTEGER,
    QUESTION_TYPE_TEXT,
    SELECT_QUESTIONS,
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
from kpi.utils.log import logging


class AutomaticBedrockQual(RequiresTranscriptionMixin, BaseQualAction):

    ID = 'automatic_bedrock_qual'
    action_class_config = ActionClassConfig(
        allow_multiple=True, automatic=True, action_data_key='uuid'
    )

    @property
    def _limit_identifier(self):
        return UsageType.LLM_REQUESTS

    def _get_question(self, uuid: str) -> dict:
        qa_question = [q for q in self.params if q['uuid'] == uuid]
        return qa_question[0]

    def _get_visible_choices(self, question: dict) -> list[dict]:
        return [
            choice
            for choice in question['choices']
            if not choice.get('options', {}).get('deleted')
        ]

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

    def get_response_from_llm(self, prompt: str) -> str:
        aws_id = settings.AWS_ACCESS_KEY_ID
        aws_secret = settings.AWS_SECRET_ACCESS_KEY
        bedrock_runtime = boto3.client(
            service_name='bedrock-runtime',
            region_name=settings.AWS_BEDROCK_REGION_NAME,
            aws_access_key_id=aws_id,
            aws_secret_access_key=aws_secret,
        )

        request = {
            'anthropic_version': 'bedrock-2023-05-31',
            'max_tokens': MAX_TOKENS,
            'temperature': MODEL_TEMPERATURE,  # keep model from getting too creative
            'messages': [
                {'role': 'user', 'content': prompt},
            ],
        }
        response = bedrock_runtime.invoke_model(
            modelId='anthropic.claude-3-5-sonnet-20240620-v1:0',
            body=json.dumps(request),
        )
        try:
            response_body = json.loads(response['body'].read())
            return response_body['content'][0]['text']
        except (JSONDecodeError, IndexError, KeyError) as e:
            # the response isn't in the form we expected
            raise InvalidResponseFromLLMException(
                'Unable to extract answer from LLM response object'
            ) from e

    @classproperty
    def params_schema(cls):
        initial_params = deepcopy(super().params_schema)
        initial_params['$defs']['qualQuestionType']['enum'].remove('qualNote')
        initial_params['$defs']['qualQuestionType']['enum'].remove('qualTags')
        return initial_params

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
                                    '_dateAccepted': {'$ref': '#/$defs/dateTime'},
                                    '_uuid': {'$ref': '#/$defs/uuid'},
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
                                'required': ['_data', '_dateCreated', '_uuid'],
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
        try:
            full_response_text = self.get_response_from_llm(prompt)
            logging.info(f'LLM prompt: \n{prompt}\nLLM response:\n{full_response_text}')
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
            return {'status': 'failed', 'error': f'{e}'}
