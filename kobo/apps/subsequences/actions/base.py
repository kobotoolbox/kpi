import datetime
from copy import deepcopy

import jsonschema
from django.conf import settings
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kpi.exceptions import UsageLimitExceededException
from kpi.utils.usage_calculator import ServiceUsageCalculator

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
    return dt.isoformat().replace('+00:00', 'Z')


class BaseAction:
    def something_to_get_the_data_back_out(self):
        # might need to deal with multiple columns for one action
        # ^ definitely will
        raise NotImplementedError

    DATE_CREATED_FIELD = '_dateCreated'
    DATE_MODIFIED_FIELD = '_dateModified'
    REVISIONS_FIELD = '_revisions'

    def check_limits(self, user: User):

        if not settings.STRIPE_ENABLED or not self._is_usage_limited:
            return

        calculator = ServiceUsageCalculator(user)
        balances = calculator.get_usage_balances()

        balance = balances[self._limit_identifier]
        if balance and balance['exceeded']:
            raise UsageLimitExceededException()

    @classmethod
    def validate_params(cls, params):
        jsonschema.validate(params, cls.params_schema)

    def validate_data(self, data):
        jsonschema.validate(data, self.data_schema)

    def validate_result(self, result):
        jsonschema.validate(result, self.result_schema)

    @property
    def result_schema(self):
        """
        we also need a schema to define the final result that will be written
        into SubmissionExtras

        we need to solve the problem of storing multiple results for a single action
        """
        return NotImplementedError

    def retrieve_data(self, action_data: dict) -> dict:
        """
        `action_data` must be ONLY the data for this particular action
        instance, not the entire SubmissionExtras caboodle

        descendant classes could override with special manipulation if needed
        """
        return action_data

    def revise_field(self, *args, **kwargs):
        # TODO: remove this alias
        import warnings
        warnings.warn('Oh no, this method is going away!', DeprecationWarning)
        return self.revise_data(*args, **kwargs)

    def revise_data(
        self, submission: dict, submission_supplement: dict, edit: dict
    ) -> dict:
        """
        for actions that may have lengthy data, are we content to store the
        entirety of the data for each revision, or do we need some kind of
        differencing system?
        """
        self.validate_data(edit)
        self.raise_for_any_leading_underscore_key(edit)

        now_str = utc_datetime_to_js_str(timezone.now())
        revision = deepcopy(submission_supplement)
        new_record = deepcopy(edit)
        revisions = revision.pop(self.REVISIONS_FIELD, [])

        revision_creation_date = revision.pop(self.DATE_MODIFIED_FIELD, now_str)
        record_creation_date = revision.pop(self.DATE_CREATED_FIELD, now_str)
        revision[self.DATE_CREATED_FIELD] = revision_creation_date
        new_record[self.DATE_MODIFIED_FIELD] = now_str

        if submission_supplement:
            revisions.insert(0, revision)
            new_record[self.REVISIONS_FIELD] = revisions

        new_record[self.DATE_CREATED_FIELD] = record_creation_date

        self.validate_result(new_record)

        return new_record


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
                raise Exception(
                    'An unexpected key with a leading underscore was found'
                )

    @property
    def _is_usage_limited(self):
        """
        Returns whether an action should check for usage limits.
        """
        raise NotImplementedError()

    def _inject_data_schema(self, destination_schema: dict, skipped_keys: list):
        """
        Utility function to inject data schema into another schema to
        avoid repeating the same schema.
        Useful to produce result schema.
        """

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

    @property
    def _limit_identifier(self):
        # Example for automatic transcription
        #
        # from kobo.apps.organizations.constants import UsageType
        # return UsageType.ASR_SECONDS
        raise NotImplementedError()
