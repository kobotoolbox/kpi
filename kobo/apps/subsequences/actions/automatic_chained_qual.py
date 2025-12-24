from copy import deepcopy

from kobo.apps.subsequences.actions.base import ActionClassConfig
from kobo.apps.subsequences.actions.mixins import RequiresTranscriptionMixin
from kobo.apps.subsequences.actions.qual import BaseQualAction


class AutomaticChainedQualAction(BaseQualAction, RequiresTranscriptionMixin):

    ID = 'automatic_chained_qual'
    action_class_config = ActionClassConfig(
        allow_multiple=True, automatic=True, action_data_key='uuid'
    )

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
        elif question['type'] == 'qualSelectMultiple':
            return {'value': [question['choices'][0][uuid]], 'status': 'complete'}
        else:
            return {'value': ['tag'], 'status': 'complete'}

    @property
    def data_schema(self):
        uuids = [q['uuid'] for q in self.params if q['type'] != 'qualNote']
        return {
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                'uuid': {'$ref': '#/$defs/uuid'},
            },
            'required': ['uuid'],
            '$defs': {
                'uid': {'type': 'string', 'enum': uuids},
            },
        }

    @property
    def external_data_schema(self):
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
            '$defs': {
                'action_status': {
                    'type': 'string',
                    'enum': ['in_progress', 'complete', 'failed', 'deleted'],
                },
                'value': {'type': ['string', 'null']},
                'error': {'type': 'string'},
                'accepted': {'type': 'boolean'},
                # --- Value rules ---
                # If status == "complete" → require "value" (string or null)
                'rule_value_required_when_complete': {
                    'if': {
                        'required': ['status'],
                        'properties': {'status': {'const': 'complete'}},
                    },
                    'then': {'required': ['value']},
                },
                # If status in {"in_progress","failed"} → forbid "value"
                'rule_value_forbidden_when_in_progress_or_failed': {
                    'if': {
                        'required': ['status'],
                        'properties': {'status': {'enum': ['in_progress', 'failed']}},
                    },
                    'then': {'not': {'required': ['value']}},
                },
                # If status == "deleted" → "value" optional, but if present it MUST be null
                'rule_value_null_only_when_deleted': {
                    'if': {
                        'required': ['status'],
                        'properties': {'status': {'const': 'deleted'}},
                    },
                    'then': {
                        'anyOf': [
                            {'not': {'required': ['value']}},  # value absent
                            {  # value present and null
                                'properties': {'value': {'type': 'null'}},
                                'required': ['value'],
                            },
                        ]
                    },
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
                # If status == "complete" → accepted allowed but optional; else forbid it
                'rule_accepted_only_when_complete': {
                    'if': {
                        'required': ['status'],
                        'properties': {'status': {'const': 'complete'}},
                    },
                    'then': {},  # optional
                    'else': {'not': {'required': ['accepted']}},
                },
            },
        }
        to_return['$defs'] = {**defs, **status_defs}
        to_return['allOf'] = common['allOf']
        return to_return
