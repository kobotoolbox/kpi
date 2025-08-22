import datetime
import jsonschema
from copy import deepcopy

# from django.utils import timezone
class FakeDjangoTimezoneUtil:
    @staticmethod
    def now():
        from zoneinfo import ZoneInfo
        return datetime.datetime.now(tz=ZoneInfo('UTC'))
timezone = FakeDjangoTimezoneUtil()

"""
### All actions must have the following components

* (check!) a unique identifier for the action
* three jsonschemas:
  1. (check!) one to validate the parameters used to configure the action
    * `ADVANCED_FEATURES_PARAMS_SCHEMA`
  2. (check!) one to validate users' requests to invoke the action, which many contain content (e.g. a manual transcript)
    * the result of `modify_jsonschema()`
  3. one to validate the result of the action - the result of `modify_jsonschema()`
    * OH NO, this doesn't happen at all yet
* a handler that receives a submission (and other metadata) and processes it
"""

"""
idea of example content in asset.advanced_features (what kind of actions are activated per question)
{
    '_version': '20250820',
    '_schema': {
        'my_audio_question': {
            'manual_transcription': [
                {'language': 'ar'},
                {'language': 'bn'},
                {'language': 'es'},
            ],
            'manual_translation': [{'language': 'fr'}, {'language': 'en'}],
        },
        'my_video_question': {
            'manual_transcription': [{'language': 'en'}],
        },
        'my_number_question': {
            'number_multiplier': [{'multiplier': 3}],
        },
    },
}

idea of example data in SubmissionExtras based on the above
{
    '_version': '20250820',
    '_submission': '<some submission uuid>',
    'my_audio_question': {
        'manual_transcription': {
            'transcript': 'هائج',
            'language': 'ar',
            '_dateCreated': '2025-08-21T20:55:42.012053Z',
            '_dateModified': '2025-08-21T20:57:28.154567Z',
            '_revisions': [
                {
                    'transcript': 'فارغ',
                    'language': 'ar',
                    '_dateCreated': '2025-08-21T20:55:42.012053Z',
                }
            ],
        },
        'manual_translation': [
            {
                'language': 'en',
                'translation': 'berserk',
                '_dateCreated': '2025-08-21T21:39:42.141306Z',
                '_dateModified': '2025-08-21T21:39:42.141306Z',
            },
            {
                'language': 'es',
                'translation': 'enloquecido',
                '_dateCreated': '2025-08-21T21:40:54.644308Z',
                '_dateModified': '2025-08-21T22:00:10.862880Z',
                '_revisions': [
                    {
                        'translation': 'loco',
                        'language': 'es',
                        '_dateCreated': '2025-08-21T21:40:54.644308Z',
                    }
                ],
            },
        ],
    },
    'my_video_question': {
        'manual_transcription': {
            'transcript': 'sea horse sea hell',
            'language': 'en',
            '_dateCreated': '2025-08-21T21:06:20.059117Z',
            '_dateModified': '2025-08-21T21:06:20.059117Z',
        },
    },
    'my_number_question': {
        'number_multiplier': {
            'numberMultiplied': 99,
            '_dateCreated': '2025-08-21T21:09:34.504546Z',
            '_dateModified': '2025-08-21T21:09:34.504546Z',
        },
    },
}
"""


def utc_datetime_to_js_str(dt: datetime.datetime) -> str:
    """
    Return a string to represent a `datetime` following the simplification of
    the ISO 8601 format used by JavaScript
    """
    # https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-date-time-string-format
    if dt.utcoffset() or not dt.tzinfo:
        raise NotImplementedError('Only UTC datetimes are supported')
    return dt.isoformat().replace("+00:00", "Z")


class BaseAction:
    def something_to_get_the_data_back_out(self):
        # might need to deal with multiple columns for one action
        # ^ definitely will
        raise NotImplementedError

    DATE_CREATED_FIELD = '_dateCreated'
    DATE_MODIFIED_FIELD = '_dateModified'
    REVISIONS_FIELD = '_revisions'

    @classmethod
    def validate_params(cls, params):
        jsonschema.validate(params, cls.params_schema)

    def validate_data(self, data):
        jsonschema.validate(data, self.data_schema)

    def validate_result(self, result):
        jsonschema.validate(result, self.result_schema)

    def record_repr(self, record: dict) -> dict:
        raise NotImplementedError()

    @property
    def result_schema(self):
        """
        we also need a schema to define the final result that will be written
        into SubmissionExtras

        we need to solve the problem of storing multiple results for a single action
        """

        # We want schema to look like this at the end
        # schema_orig = {
        #     '$schema': 'https://json-schema.org/draft/2020-12/schema',
        #     'title': 'Transcript with revisions',
        #     'type': 'object',
        #     'additionalProperties': False,
        #     'properties': {
        #         'language': {'$ref': '#/$defs/lang'},
        #         'transcript': {'$ref': '#/$defs/transcript'},
        #         'revisions': {
        #             'type': 'array',
        #             'minItems': 1,
        #             'items': {'$ref': '#/$defs/revision'},
        #         },
        #         '_dateCreated': {'$ref': '#/$defs/dateTime'},
        #         '_dateModified': {'$ref': '#/$defs/dateTime'},
        #     },
        #     'required': ['_dateCreated', '_dateModified'],
        #     'allOf': [
        #         {
        #             '$ref': '#/$defs/lang_transcript_dependency'
        #         }
        #     ],
        #     '$defs': {
        #         'lang': {'type': 'string', 'enum':  self.languages},
        #         'transcript': {'type': 'string'},
        #         'dateTime': {'type': 'string', 'format': 'date-time'},
        #         'lang_transcript_dependency': {
        #             'allOf': [
        #                 {
        #                     'if': {'required': ['language']},
        #                     'then': {'required': ['transcript']}
        #                 },
        #                 {
        #                     'if': {'required': ['transcript']},
        #                     'then': {'required': ['language']}
        #                 }
        #             ]
        #         },
        #         'revision': {
        #             'type': 'object',
        #             'additionalProperties': False,
        #             'properties': {
        #                 'language': {'$ref': '#/$defs/lang'},
        #                 'transcript': {'$ref': '#/$defs/transcript'},
        #                 '_dateCreated': {'$ref': '#/$defs/dateTime'},
        #             },
        #             'required': ['_dateCreated'],
        #             'allOf': [
        #                 {
        #                     "$ref": "#/$defs/lang_transcript_dependency"
        #                 }
        #             ],
        #         },
        #     },
        # }

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
                }
            },
        }

        def _inject_data_schema(destination_schema: dict, skipped_keys: list) -> dict:

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

    def revise_field(self, submission_extra: dict, edit: dict) -> dict:
        raise NotImplementedError

    @staticmethod
    def raise_for_any_leading_underscore_key(d: dict):
        """
        Keys with leading underscores are reserved for metadata like
        `_dateCreated`, `_dateModified`, and `_revisions`. No key with a
        leading underscore should be present in data POSTed by a client or
        generated by an action.

        Schema validation should block invalid keys, but this method exists as
        a redundant check to guard against schema mistakes.
        """
        for k in list(d.keys()):
            try:
                match = k.startswith('_')
            except AttributeError:
                continue
            if match:
                raise Exception('An unexpected key with a leading underscore was found')
