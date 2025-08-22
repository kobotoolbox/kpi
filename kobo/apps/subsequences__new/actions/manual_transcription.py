from copy import deepcopy

from .base import BaseAction


class ManualTranscriptionAction(BaseAction):
    ID = 'manual_transcription'

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
        (currently) POST to "/advanced_submission_post/aSsEtUiD"
        POST to "/api/v2/assets/<asset uid>/data/<submission uuid>/supplemental"  # idk, rename?
        {
            'manual_transcription': {
                'language': 'es',
                'transcript': 'Almorzamos muy bien hoy',
            }
        }
        """

        return {
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                'language': {'$ref': '#/$defs/lang'},
                'transcript': {'$ref': '#/$defs/transcript'},
            },
            'allOf': [{'$ref': '#/$defs/lang_transcript_dependency'}],
            '$defs': {
                'lang': {'type': 'string', 'enum': self.languages},
                'transcript': {'type': 'string'},
                'lang_transcript_dependency': {
                    'allOf': [
                        {
                            'if': {'required': ['language']},
                            'then': {'required': ['transcript']},
                        },
                        {
                            'if': {'required': ['transcript']},
                            'then': {'required': ['language']},
                        },
                    ]
                },
            },
        }

    @property
    def languages(self) -> list[str]:
        languages = []
        for individual_params in self.params:
            languages.append(individual_params['language'])
        return languages

    def record_repr(self, record: dict) -> dict:
        return record.get('transcript', '')

    @property
    def result_schema(self):

        result_schema_template = {
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

        def _inject_data_schema(
            destination_schema: dict, skipped_keys: list
        ) -> dict:

            for key, value in self.data_schema.items():
                if key in skipped_keys:
                    continue

                if key in destination_schema:
                    if isinstance(destination_schema[key], dict):
                        destination_schema[key].update(self.data_schema[key])
                    elif isinstance(destination_schema[key], list):
                        destination_schema[key].extend(self.data_schema[key])
                    else:
                        destination_schema[key] = self.data_schema[key]
                else:
                    destination_schema[key] = self.data_schema[key]

        # Inject data schema in result schema template
        schema = deepcopy(result_schema_template)
        _inject_data_schema(schema, ['$schema', 'title', 'type'])

        # Also inject data schema in the revision definition
        _inject_data_schema(
            schema['$defs']['revision'], ['$schema', 'title', '$defs']
        )

        return schema

    @property
    def _is_usage_limited(self):
        return False
