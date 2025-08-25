from .base import BaseAction, ActionLookupConfig


class ManualTranscriptionAction(BaseAction):
    ID = 'manual_transcription'
    lookup_config = ActionLookupConfig({}, None)

    def __init__(self, source_question_xpath, params):
        self.source_question_xpath = source_question_xpath
        self.params = params

    """
    For an audio question called `my_audio_question` that's transcribed
    into 3 languages, the schema for `Asset.advanced_features` might look
    like:
        'my_audio_question': {
            'manual_transcription': [
                {'language': 'ar'},
                {'language': 'bn'},
                {'language': 'es'},
            ],
        }

    The `params_schema` attribute defines the shape of the array where each
    element is an object with a single string property for the transcript
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
    def languages(self) -> list[str]:
        languages = []
        for individual_params in self.params:
            languages.append(individual_params['language'])
        return languages

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
            },
            'required': [self.DATE_CREATED_FIELD, self.DATE_MODIFIED_FIELD],
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
            },
        }

        # Inject data schema in result schema template
        self._inject_data_schema(schema, ['$schema', 'title', 'type'])

        # Also inject data schema in the revision definition
        self._inject_data_schema(
            schema['$defs']['revision'], ['$schema', 'title', '$defs']
        )

        return schema

    @property
    def _is_usage_limited(self):
        return False
