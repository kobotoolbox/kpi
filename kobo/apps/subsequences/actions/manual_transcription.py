from typing import Any

from .base import ActionClassConfig, BaseLanguageAction


class ManualTranscriptionAction(BaseLanguageAction):
    ID = 'manual_transcription'
    action_class_config = ActionClassConfig({}, None, False)

    def _get_output_field_name(self, language: str) -> str:
        language = language.split('-')[0]  # ignore region if any
        return f"{self.source_question_xpath}/transcription__{language}"

    def get_output_fields(self) -> list[dict]:
        return [
            {
                'language': params['language'],
                'name': self._get_output_field_name(params['language']),
                'source': self.source_question_xpath,
                'type': 'transcript',
            } for params in self.params
        ]

    def transform_data_for_output(self, action_data: dict) -> dict[str, dict[str, Any]]:
        # keep next to `get_output_fields()` for now

        # Sir, there's only one current transcript per response
        return {
            self._get_output_field_name(action_data['language']): {
                'language': action_data['language'],
                'value': action_data['value'],
                self.DATE_ACCEPTED_FIELD: action_data[self.DATE_MODIFIED_FIELD],
            }
        }

    @property
    def data_schema(self):  # for lack of a better name
        """
        POST to "/api/v2/assets/<asset uid>/data/<submission uuid>/supplemental"
        {
            'manual_transcription': {
                'language': 'es',
                'value': 'Almorzamos muy bien hoy',
            }
        }
        """

        return {
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                'language': {'$ref': '#/$defs/lang'},
                'value': {'$ref': '#/$defs/value'},
            },
            'required': ['language', 'value'],
            '$defs': {
                'lang': {'type': 'string', 'enum': self.languages},
                'value': {'type': ['string', 'null']},
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

        return schema
