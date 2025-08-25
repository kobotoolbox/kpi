from .base import BaseAction, ActionClassConfig


class ManualTranslationAction(BaseAction):
    ID = 'manual_translation'
    action_class_config = ActionClassConfig([], 'language', False)

    """
    For an audio question called `my_audio_question` that's translated
    into 3 languages, the schema for `Asset.advanced_features` might look
    like:
        'my_audio_question': {
            'manual_translation': [
                {'language': 'fr'},
                {'language': 'es'},
            ],
        }

    The `params_schema` attribute defines the shape of the array where each
    element is an object with a single string property for the translation
    language.
    """
    params_schema = {
        'type': 'array',
        'items': {
            'additionalProperties': False,
            'properties': {
                'language': {
                    'type': 'string',
                }
            },
            'required': ['language'],
            'type': 'object',
        },
    }

    def _get_output_field_name(self, language: str) -> str:
        language = language.split('-')[0]  # ignore region if any
        return f"{self.source_question_xpath}/translation__{language}"

    def get_output_fields(self):
        return [
            {
                'language': params['language'],
                'name': self._get_output_field_name(params['language']),
                'source': self.source_question_xpath,
                'type': 'translation',
            } for params in self.params
        ]

    def transform_data_for_output(self, action_data: list[dict]) -> list[dict]:
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
    def data_schema(self):  # for lack of a better name
        """
        POST to "/api/v2/assets/<asset uid>/data/<submission uuid>/supplemental"
        {
            'manual_translation': {
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
    def languages(self) -> list[str]:
        languages = []
        for individual_params in self.params:
            languages.append(individual_params['language'])
        return languages

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
