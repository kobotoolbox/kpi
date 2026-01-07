from copy import deepcopy

from django.utils.functional import classproperty

from kobo.apps.organizations.constants import UsageType
from kobo.apps.subsequences.actions.base import ActionClassConfig
from kobo.apps.subsequences.actions.mixins import RequiresTranscriptionMixin
from kobo.apps.subsequences.actions.qual import BaseQualAction


class AutomaticBedrockQual(RequiresTranscriptionMixin, BaseQualAction):

    ID = 'automatic_bedrock_qual'
    action_class_config = ActionClassConfig(
        allow_multiple=True, automatic=True, action_data_key='uuid'
    )

    @property
    def _limit_identifier(self):
        return UsageType.LLM_REQUESTS

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
        Update action_data with external process

        Stub for testing
        """
        uuid = action_data['uuid']
        found = [q for q in self.params if q['uuid'] == uuid]
        if len(found) != 1:
            raise Exception(f'UUID {uuid} not found')
        question = found[0]
        if question['type'] == 'qualInteger':
            return {'value': 1, 'status': 'complete'}
        elif question['type'] == 'qualText':
            return {'value': 'Text', 'status': 'complete'}
        elif question['type'] == 'qualSelectOne':
            return {'value': question['choices'][0][uuid], 'status': 'complete'}
        else:
            return {'value': [question['choices'][0][uuid]], 'status': 'complete'}
