from kobo.apps.organizations.constants import UsageType
from .base import ActionClassConfig, BaseLanguageAction
from ..integrations.google.google_transcribe import GoogleTranscriptionService


class AutomaticGoogleTranscriptionAction(BaseLanguageAction):
    ID = 'automatic_google_transcription'
    action_class_config = ActionClassConfig({}, None, True)

    @property
    def automated_data_schema(self) -> dict:
        """
        Schema rules:

        - The field `status` is always required and must be one of:
          ["requested", "in_progress", "completed", "failed"].
        - If `status` == "done":
            * The field `value` becomes required and must be a string.
        - If `status` == "failed":
            * The field `error` becomes required and must be a string.
        - No additional properties are allowed beyond `language`, `status` and `value`.
        """
        return {
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                'language': {'$ref': '#/$defs/lang'},
                'locale': {'$ref': '#/$defs/locale'},
                'status': {'$ref': '#/$defs/action_status'},
                'value': {'$ref': '#/$defs/value'},
                'error': {'$ref': '#/$defs/error'},
                'accepted': {'$ref': '#/$defs/accepted'},
            },
            'required': ['language', 'status'],
            'allOf': [
                # value must be present iff status == "complete"
                {'$ref': '#/$defs/rule_value_presence_when_complete'},
                # error must be present iff status == "failed"
                {'$ref': '#/$defs/rule_error_presence_when_failed'},
                # accepted must be present iff status == "complete"
                {'$ref': '#/$defs/rule_accepted_only_when_complete'},
            ],
            '$defs': {
                'lang': {'type': 'string', 'enum': self.languages},
                'locale': {'type': ['string', 'null']},
                'action_status': {
                    'type': 'string',
                    'enum': ['in_progress', 'complete', 'failed'],
                },
                'value': {'type': 'string'},
                'error': {'type': 'string'},
                'accepted': {'type': 'boolean'},

                # If status == "complete" → require "value"; else "value" must be absent
                'rule_value_presence_when_complete': {
                    'if': {
                        'required': ['status'],
                        'properties': {'status': {'const': 'complete'}},
                    },
                    'then': {'required': ['value']},
                    'else': {'not': {'required': ['value']}},
                },

                # If status == "failed" → require "error"; else "error" must be absent
                'rule_error_presence_when_failed': {
                    'if': {
                        'required': ['status'],
                        'properties': {'status': {'const': 'failed'}},
                    },
                    'then': {'required': ['error']},
                    'else': {'not': {'required': ['error']}},
                },

                # If status == "complete" → accepted is allowed but optional
                # Else → accepted must not be present
                'rule_accepted_only_when_complete': {
                    'if': {
                        'required': ['status'],
                        'properties': {'status': {'const': 'complete'}},
                    },
                    'then': {},  # no requirement: accepted may be present or absent
                    'else': {'not': {'required': ['accepted']}},
                }
            },
        }

    @property
    def data_schema(self) -> dict:
        """
        Schema rules:

        - The field `status` is always required and must be one of:
          ["requested", "in_progress"].
        - `value` should not be present
        - No additional properties are allowed beyond `language`, `status`.
        """
        return {
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                'language': {'$ref': '#/$defs/lang'},
                'locale': {'$ref': '#/$defs/locale'},
                'accepted': {'$ref': '#/$defs/accepted'},
            },
            'required': ['language'],
            '$defs': {
                'lang': {'type': 'string', 'enum': self.languages},
                'locale': {'type': ['string', 'null']},
                'accepted': {'type': 'boolean'},
            },
        }

    @property
    def result_schema(self):

        schema = {
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                self.REVISIONS_FIELD: {
                    'type': 'array',
                    'minItems': 1,
                    'items': {'$ref': '#/$defs/revision'},
                },
                self.DATE_CREATED_FIELD: {'$ref': '#/$defs/dateTime'},
                self.DATE_MODIFIED_FIELD: {'$ref': '#/$defs/dateTime'},
                self.DATE_ACCEPTED_FIELD: {'$ref': '#/$defs/dateTime'},
            },
            'required': [self.DATE_CREATED_FIELD, self.DATE_MODIFIED_FIELD],
            '$defs': {
                'dateTime': {'type': 'string', 'format': 'date-time'},
                'revision': {
                    'type': 'object',
                    'additionalProperties': False,
                    'properties': {
                        self.DATE_CREATED_FIELD: {'$ref': '#/$defs/dateTime'},
                        self.DATE_ACCEPTED_FIELD: {'$ref': '#/$defs/dateTime'},
                    },
                    'required': [self.DATE_CREATED_FIELD],
                },
            },
        }

        # Inject data schema in result schema template
        self._inject_data_schema(schema, ['$schema', 'title', 'type'])

        # Also inject data schema in the revision definition
        self._inject_data_schema(
            schema['$defs']['revision'], ['$schema', 'title', '$defs']
        )

        # FIXME _inject_data_schema does not merge nested children
        schema['$defs']['action_status'] = {
            'action_status': {
                'type': 'string',
                'enum': ['in_progress', 'complete', 'error'],
            },
        }
        return schema

    def run_automatic_process(
        self,
        submission: dict,
        submission_supplement: dict,
        action_data: dict,
        *args,
        **kwargs,
    ) -> dict:
        """
        Run the automatic transcription process using the Google API.

        This method validates and processes the incoming `action_data` before it is
        passed to `revise_data()`. If the payload indicates that the user accepts the
        last completed transcription, the method returns early with the accepted data.
        Otherwise, it triggers the external Google transcription service and returns
        the processed result.

        Returns:
            dict: Processed transcription data, ready to be merged and validated by
            `revise_data()`.
        """

        # Validate `action_data` against schema rules before further processing.
        # `revise_data()` will perform the final validation once merged with the
        # supplement returned by this method.
        self.validate_data(action_data)
        self.raise_for_any_leading_underscore_key(action_data)

        # If the client explicitly provided "accepted", it means they only want to
        # accept the last completed transcription. In this case, return immediately.
        # `revise_data()` will handle merging and final validation of the acceptance.
        accepted = action_data.get('accepted', None)
        if (
            submission_supplement.get('status') == 'complete'
            and accepted is not None
        ):
            return {
                'value': submission_supplement['value'],
                'status': 'complete',
            }

        # Otherwise, call the Google transcription service to process the input data.
        service = GoogleTranscriptionService(submission, asset=kwargs['asset'])
        service_data = service.process_data(
            self.source_question_xpath, action_data
        )

        return service_data

    def _limit_identifier(self):
        return UsageType.ASR_SECONDS
