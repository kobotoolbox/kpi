from typing import Any

from .base import ActionClassConfig, BaseLanguageAction


class ManualTranslationAction(BaseLanguageAction):
    ID = 'manual_translation'
    action_class_config = ActionClassConfig([], 'language', False)

    def _get_output_field_name(self, language: str) -> str:
        language = language.split('-')[0]  # ignore region if any
        return f'{self.source_question_xpath}/translation__{language}'

    def get_output_fields(self):
        return [
            {
                'language': params['language'],
                'name': self._get_output_field_name(params['language']),
                'source': self.source_question_xpath,
                'type': 'translation',
            }
            for params in self.params
        ]

    def transform_data_for_output(
        self, action_data: list[dict]
    ) -> dict[str, dict[str, Any]]:
        # keep next to `get_output_fields()` for now
        return {
            self._get_output_field_name(translation_data['language']): {
                'language': translation_data['language'],
                'value': translation_data['value'],
                '_dateAccepted': translation_data[self.DATE_MODIFIED_FIELD],
            }
            for translation_data in action_data
        }

    @property
    def result_schema(self):

        localized_value_schema = {
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
        }

        # Inject data schema in result schema template
        self._inject_data_schema(localized_value_schema, ['$schema', 'title', 'type'])

        # Move localized_value_schema definitions to main schema
        localized_value_schema_defs = localized_value_schema.pop('$defs')

        schema = {
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'type': 'array',
            'additionalProperties': False,
            'items': {'$ref': '#/$defs/localized_value_schema'},
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
                'localized_value_schema': localized_value_schema,
                **localized_value_schema_defs,
            },
        }

        # Also inject data schema in the revision definition
        self._inject_data_schema(
            schema['$defs']['revision'], ['$schema', 'title', '$defs']
        )

        return schema

    @property
    def _is_usage_limited(self):
        return False
