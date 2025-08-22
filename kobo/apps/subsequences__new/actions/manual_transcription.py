import datetime
import jsonschema
from copy import deepcopy

from ..actions.base import BaseAction, utc_datetime_to_js_str


# from django.utils import timezone
class FakeDjangoTimezoneUtil:
    @staticmethod
    def now():
        from zoneinfo import ZoneInfo
        return datetime.datetime.now(tz=ZoneInfo('UTC'))
timezone = FakeDjangoTimezoneUtil()


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

        now_str = utc_datetime_to_js_str(timezone.now())
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
