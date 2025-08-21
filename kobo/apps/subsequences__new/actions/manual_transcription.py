import jsonschema
from copy import deepcopy

# from django.utils import timezone
from datetime import datetime as timezone

# from ..constants import TRANSCRIBABLE_SOURCE_TYPES
# from ..actions.base import BaseAction

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
    'version': '20250820',
    'schema': {
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
    'version': '20250820',
    'submission': '<some submission uuid>',
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
        # WIP 'manual_translation': [{'language': 'fr'}, {'language': 'en'}],
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


def utc_datetime_to_simplified_iso8601(dt):
    # https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-date-time-string-format
    if dt.utcoffset():  # or not dt.tzinfo:
        raise NotImplementedError('Only UTC datetimes are supported')
    return dt.isoformat().replace("+00:00", "Z")


class BaseAction:

    # is a leading underscore a good convention for marking things that must
    # not be set by the action result? alternatively, we could nest all the
    # action results inside some object or, we could nest all the
    # non-action-result metadata-type things inside an object, and protect that
    # from being overwritten by the action
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
        # languages = []
        # for individual_params in self.params:
        #    languages.append(individual_params['language'])

        # return {
        #     'oneOf': [
        #         {
        #             'additionalProperties': False,
        #             'properties': {
        #                 'language': {
        #                     'type': 'string',
        #                     'enum': languages,
        #                 },
        #                 'transcript': {
        #                     'type': 'string',
        #                 },
        #             },
        #             'required': ['language', 'transcript'],
        #             'type': 'object',
        #         },
        #         {
        #             # also allow an empty object (used to delete the transcript)
        #             'additionalProperties': False,
        #             'type': 'object',
        #         },
        #     ]
        # }
        return {
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                'language': {'$ref': '#/$defs/lang'},
                'transcript': {'$ref': '#/$defs/transcript'}
            },
            'allOf': [
                {
                    '$ref': '#/$defs/lang_transcript_dependency'
                }
            ],
            '$defs': {
                'lang': {'type': 'string', 'enum': self.languages},
                'transcript': {'type': 'string'},
                'lang_transcript_dependency': {
                    'allOf': [
                        {
                            'if': {'required': ['language']},
                            'then': {'required': ['transcript']}
                        },
                        {
                            'if': {'required': ['transcript']},
                            'then': {'required': ['language']}
                        }
                    ]
                }
            }
        }

    @property
    def languages(self) -> list[str]:
        languages = []
        for individual_params in self.params:
            languages.append(individual_params['language'])
        return languages

    def record_repr(self, record: dict) -> dict:
        return record.get('transcript', '')

    def revise_field(self, submission_extra: dict, edit: dict) -> dict:
        """
        really, we want to generalize this to all actions.
        for actions that may have lengthy data, are we content to store the
        entirety of the data for each revision, or do we need some kind of
        differencing system?
        """
        self.validate_data(edit)
        self.raise_for_any_leading_underscore_key(edit)

        now_str = utc_datetime_to_simplified_iso8601(timezone.now())
        revision = deepcopy(submission_extra)
        new_record = deepcopy(edit)
        revisions = revision.pop(self.REVISIONS_FIELD, [])

        revision_creation_date = revision.pop(self.DATE_MODIFIED_FIELD, now_str)
        record_creation_date = revision.pop(self.DATE_CREATED_FIELD, now_str)
        revision[self.DATE_CREATED_FIELD] = revision_creation_date
        new_record[self.DATE_MODIFIED_FIELD] = now_str

        if submission_extra:
            revisions.insert(0, revision)
            new_record[self.REVISIONS_FIELD] = revisions

        new_record[self.DATE_CREATED_FIELD] = record_creation_date

        return new_record
