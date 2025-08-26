from kobo.apps.organizations.constants import UsageType
from ..integrations.google.google_transcribe import GoogleTranscriptionService
from .base import ActionClassConfig, BaseLanguageAction


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
                # value is required when status == "complete"
                {'$ref': '#/$defs/rule_value_required_when_complete'},
                # value must be absent when status in {"in_progress","failed"}
                {'$ref': '#/$defs/rule_value_forbidden_when_in_progress_or_failed'},
                # value is optional but must be null when status == "deleted"
                {'$ref': '#/$defs/rule_value_null_only_when_deleted'},
                # error must be present iff status == "failed"
                {'$ref': '#/$defs/rule_error_presence_when_failed'},
                # accepted allowed only when status == "complete" (optional)
                {'$ref': '#/$defs/rule_accepted_only_when_complete'},
            ],
            '$defs': {
                'lang': {'type': 'string', 'enum': self.languages},
                'locale': {'type': ['string', 'null']},
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

    @property
    def data_schema(self) -> dict:
        """
        Schema rules:

        - `language` is required.
        - `value` is optional but, if present, it MUST be `null` (no other type allowed).
        - `accepted` is optional.
        - Mutual exclusion: `accepted` and `value` cannot be present at the same time.
          * If `value` is present (and thus equals null), `accepted` must be absent.
          * If `accepted` is present, `value` must be absent.
        - No additional properties are allowed beyond: `language`, `locale`, `value`, `accepted`.
        """
        return {
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                'language': {'$ref': '#/$defs/lang'},
                'locale': {'$ref': '#/$defs/locale'},
                'value': {'$ref': '#/$defs/value_null_only'},
                'accepted': {'$ref': '#/$defs/accepted'},
            },
            'required': ['language'],
            'allOf': [
                # Forbid having both `accepted` and `value` at the same time
                {'not': {'required': ['accepted', 'value']}},
            ],
            '$defs': {
                'lang': {'type': 'string', 'enum': self.languages},
                'locale': {'type': ['string', 'null']},
                'accepted': {'type': 'boolean'},
                # Only null is permitted for `value`
                'value_null_only': {'type': 'null'},
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

    @property
    def _limit_identifier(self):
        return UsageType.ASR_SECONDS

    def _run_automatic_process(
        self,
        submission: dict,
        submission_supplement: dict,
        action_data: dict,
        *args,
        **kwargs,
    ) -> dict | None:
        """
        Run the automatic transcription process using the Google API.

        This method is intended to be called by `revise_data()`, which will finalize
        the validation and merging of `action_data`. If the user explicitly accepts
        the last completed transcription, the method short-circuits and returns it
        immediately. If the transcription request is still in progress, the method
        returns None so that `revise_data()` can exit early and skip unnecessary
        processing. Otherwise, it calls the Google API and returns the processed
        result, ready to be passed back to `revise_data()`.
        """

        # If the client sent "accepted" while the supplement is already complete,
        # return the completed transcription right away. `revise_data()` will handle
        # the merge and final validation of this acceptance.
        accepted = action_data.get('accepted', None)
        if submission_supplement.get('status') == 'complete' and accepted is not None:
            return {
                'value': submission_supplement['value'],
                'status': 'complete',
            }

        # TBC
        if 'value' in action_data:
            return {
                'value': action_data['value'],
                'status': 'deleted',
            }

        # Otherwise, trigger the external Google transcription service.
        service = GoogleTranscriptionService(submission, asset=kwargs['asset'])
        service_data = service.process_data(self.source_question_xpath, action_data)

        # If the transcription request is still running, stop processing here.
        # Returning None ensures that `revise_data()` will not be called afterwards.
        if (
            accepted is None
            and submission_supplement.get('status')
            == service_data['status']
            == 'in_progress'
        ):
            return None

        # Normal case: return the processed transcription data.
        return service_data
