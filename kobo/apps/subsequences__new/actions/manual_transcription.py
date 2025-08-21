import jsonschema
from copy import deepcopy

# from django.utils import timezone
from datetime import datetime as timezone

#from ..constants import TRANSCRIBABLE_SOURCE_TYPES
#from ..actions.base import BaseAction

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
            'manual_translation': [{'language': 'fr'}],
        },
        'my_video_question': {
            'manual_transcription': [{'language': 'en'}],
        },
        'my_number_question': {
            'number_multiplier': [{'multiplier': 3}],
        },
    },
}
"""

class BaseAction:

    DATE_CREATED_FIELD = 'dateCreated'
    DATE_MODIFIED_FIELD = 'dateModified'
    DELETE = '⌫'

    @classmethod
    def validate_params(cls, params):
        jsonschema.validate(params, cls.params_schema)

    def validate_data(self, data):
        jsonschema.validate(data, self.data_schema)

    def record_repr(self, record : dict) -> dict:
        raise NotImplementedError()

    def revise_field(self, submission_extra: dict, edit: dict) -> dict:
        raise NotImplementedError


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
        languages = []
        for individual_params in self.params:
            languages.append(individual_params['language'])

        return {
            'additionalProperties': False,
            'properties': {
                'language': {
                    'type': 'string',
                    'enum': languages,
                },
                'transcript': {
                    'type': 'string',
                },
            },
            'required': ['language', 'transcript'],
            'type': 'object',
        }

    def record_repr(self, record : dict) -> dict:
        return record.get('transcript', '')

    @classmethod
    @property
    def result_schema(cls):
        """
        we also need a schema to define the final result that will be written
        into SubmissionExtras

        we need to solve the problem of storing multiple results for a single action
        """
        raise NotImplementedError

    def revise_field(self, submission_extra: dict, edit: dict) -> dict:
        """
        """

        if self.record_repr(edit) == self.DELETE:
            return {}

        now_str = timezone.now().strftime('%Y-%m-%dT%H:%M:%SZ')
        revision = deepcopy(submission_extra)
        new_record = deepcopy(edit)
        revisions = revision.pop('revisions', [])

        revision_creation_date = revision.pop(self.DATE_MODIFIED_FIELD, now_str)
        record_creation_date = revision.pop(self.DATE_CREATED_FIELD, now_str)
        revision[self.DATE_CREATED_FIELD] = revision_creation_date
        new_record[self.DATE_MODIFIED_FIELD] = now_str

        if submission_extra:
            revisions.insert(0, revision)
            new_record['revisions'] = revisions

        new_record[self.DATE_CREATED_FIELD] = record_creation_date

        return new_record
