import base64
from copy import deepcopy
from json import JSONDecodeError
from typing import Optional
from xml.sax.saxutils import escape

from botocore.exceptions import ClientError, ConnectTimeoutError, ReadTimeoutError
from django.utils.functional import classproperty
from django_userforeignkey.request import get_current_request

from kobo.apps.organizations.constants import UsageType
from kobo.apps.subsequences.actions.base import ActionClassConfig, ReviewType
from kobo.apps.subsequences.actions.mixins import RequiresAdditionalSource
from kobo.apps.subsequences.actions.qual import BaseQualAction
from kobo.apps.subsequences.constants import (
    IMAGE_SOURCE_TYPE,
    QUAL_SOURCE_TYPES,
    QUESTION_TYPE_INTEGER,
    QUESTION_TYPE_NOTE,
    QUESTION_TYPE_TAGS,
    QUESTION_TYPE_TEXT,
    SELECT_QUESTIONS,
    SOURCE_TYPE_AUTOMATIC,
    TEXT_SOURCE_TYPE,
)
from kobo.apps.subsequences.exceptions import (
    AnalysisQuestionIncorrectlyConfigured,
    AnalysisQuestionNotFound,
    ManualQualNotFound,
)
from kobo.apps.subsequences.prompts import (
    MAX_TOKENS,
    MODEL_TEMPERATURE,
    InvalidResponseFromLLMException,
    analysis_question_placeholder,
    choices_list_placeholder,
    example_format_placeholder,
    format_choices,
    format_hint,
    get_example_format,
    get_prompt_template,
    hint_placeholder,
    num_choice_placeholder,
    parse_choices_response,
    parse_integer_response,
    parse_text_response,
    response_placeholder,
)
from kobo.apps.trackers.utils import update_nlp_counter
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)
from kpi.exceptions import AttachmentNotFoundException
from kpi.utils.log import logging

from .automatic_bedrock_qual_utils import (
    CLIENTS_BY_ID,
    OSS120,
    ClaudeSonnet,
    Gemma4,
    LLModel,
)


class AutomaticBedrockQual(RequiresAdditionalSource, BaseQualAction):

    ID = 'automatic_bedrock_qual'
    allowed_source_types = QUAL_SOURCE_TYPES
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
        choices = [
            choice
            for choice in question['choices']
            if not choice.get('options', {}).get('deleted')
        ]
        if len(choices) == 0:
            raise AnalysisQuestionIncorrectlyConfigured
        return choices

    def check_limits(self, user, action_data: dict):
        verified = action_data.get('verified', None)
        if verified is not None:
            return

        super().check_limits(user, action_data)

    def construct_external_request(self, action_data, submission):
        survey_question_type = action_data['_dependency'].get('_question_type')
        prompt = self.generate_llm_text_prompt(action_data, submission)
        if survey_question_type == IMAGE_SOURCE_TYPE:
            attachments = submission.get('_attachments', [])
            try:
                attachment = next(
                    a
                    for a in attachments
                    if a.get('question_xpath') == self.source_question_xpath
                )
                with default_storage.open(attachment.get('filename')) as fp:
                    image_bytes = base64.b64encode(fp.read()).decode('utf-8')
                    image_mimetype = attachment.get('mimetype')
                return self.construct_image_request(prompt, image_bytes, image_mimetype)
            except (FileNotFoundError, StopIteration):
                raise AttachmentNotFoundException()
        else:
            return self.construct_text_request(prompt)

    def construct_image_request(self, prompt, image_bytes, mimetype):
        return {
            'role': 'user',
            'content': [
                {'type': 'input_text', 'text': prompt},
                {
                    'type': 'input_image',
                    'image_url': f'data:{mimetype};base64,{image_bytes}',
                },
            ],
        }

    def construct_text_request(self, prompt):
        return {
            'anthropic_version': 'bedrock-2023-05-31',
            'max_tokens': MAX_TOKENS,
            'temperature': MODEL_TEMPERATURE,  # keep model from getting too creative
            'messages': [
                {'role': 'user', 'content': prompt},
            ],
        }

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

    def generate_llm_text_prompt(self, action_data: dict, submission: dict) -> str:
        """
        Generate the prompt that will be sent to the llm
        """
        # get the correct template based on the source and QA question types
        question_uuid = action_data['uuid']
        qa_question = self._get_question(question_uuid)
        question_text = escape(qa_question['labels']['_default'])
        question_type = qa_question['type']
        source_question_type = action_data['_dependency'].get('_question_type')
        prompt_template = get_prompt_template(source_question_type, question_type)
        if source_question_type == TEXT_SOURCE_TYPE:
            # source text is survey answer, stored on the submission
            source_text = escape(str(submission.get(self.source_question_xpath) or ''))
            prompt_template = prompt_template.replace(response_placeholder, source_text)
        elif source_question_type != IMAGE_SOURCE_TYPE:
            # source text is transcript, stored in the dependency
            source_text = escape(action_data['_dependency']['value'])
            prompt_template = prompt_template.replace(response_placeholder, source_text)

        raw_hint = qa_question.get('hint', {}).get('labels', {}).get('_default')
        hint = raw_hint and escape(raw_hint)
        hint = f' {format_hint(hint)}' if hint else ''
        # if it's not a select question, we only need the source text and the
        # question text to fill out the prompt
        if question_type not in SELECT_QUESTIONS:
            return prompt_template.replace(
                analysis_question_placeholder, question_text
            ).replace(hint_placeholder, hint)
        else:
            # for select questions, need to get all the choices
            visible_choices = self._get_visible_choices(qa_question)
            visible_choice_labels = []
            for choice in visible_choices:
                label = choice['labels']['_default']
                choice_hint = (
                    choice.get('hint', {}).get('labels', {}).get('_default', '')
                )
                visible_choice_labels.append(
                    {'label': escape(label), 'hint': escape(choice_hint)}
                )
            choices_text = format_choices(visible_choice_labels)
            choices_count = len(visible_choices)
            example_format = get_example_format(question_type, choices_count)
            return (
                prompt_template.replace(analysis_question_placeholder, question_text)
                .replace(num_choice_placeholder, str(choices_count))
                .replace(example_format_placeholder, example_format)
                .replace(choices_list_placeholder, choices_text)
                .replace(hint_placeholder, hint)
            )

    def get_question_params(self):
        from kobo.apps.subsequences.actions import ManualQualAction

        return [
            param_dict
            for param_dict in self._action_dependencies['params'][ManualQualAction.ID]
            if param_dict['type'] not in [QUESTION_TYPE_NOTE, QUESTION_TYPE_TAGS]
        ]

    def get_response_from_llm(self, request_data: dict, model: LLModel) -> str:
        client = CLIENTS_BY_ID[model.client_id]()
        try:
            return client.get_response_from_llm(request_data, model)
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
        survey_question_type = action_data['_dependency'].get('_question_type')
        error = ''

        request = self.construct_external_request(action_data, submission)
        if survey_question_type == IMAGE_SOURCE_TYPE:
            models = [Gemma4]
        else:
            models = [OSS120, ClaudeSonnet]

        update_nlp_counter(
            'bedrock_llm_requests',
            1,
            self.asset.owner_id,
            self.asset.id,
        )

        # for now, hardcode OSS to be primary and Claude to be backup
        # eventually this will be configurable
        for index, model in enumerate(models):
            try:
                full_response_text = self.get_response_from_llm(request, model)
                # edge case: sometimes the LLM returns None
                if full_response_text is None:
                    raise InvalidResponseFromLLMException('LLM returned empty response')
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
                    if len(selected_indexes) == 0:
                        # empty string is the correct empty value for select one
                        return {'value': '', 'status': 'complete'}
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
            except (
                InvalidResponseFromLLMException,
                ClientError,
                ReadTimeoutError,
                ConnectTimeoutError,
            ) as e:
                if index < len(models) - 1:
                    logging.warning(
                        f'Invalid response or timeout from primary llm {model}: {e}.'
                        ' Defaulting to backup.'
                    )
                error = e
                continue

        logging.warning(
            f'All LLMs failed for question {qa_question_uuid}. '
            f'Final error: {error}'
        )
        if request := get_current_request():
            request.llm_response = {'error': f'{error}'}
        return {'status': 'failed', 'error': f'{error}'}

    def update_params(self, incoming_params):
        self.validate_params(incoming_params)
        current_uuids = set([param['uuid'] for param in self.params])
        for param in incoming_params:
            if param['uuid'] not in current_uuids:
                self.params.append(param)

    @property
    def source(self):
        return SOURCE_TYPE_AUTOMATIC
