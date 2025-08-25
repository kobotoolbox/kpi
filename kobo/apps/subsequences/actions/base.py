from copy import deepcopy
from dataclasses import dataclass

import jsonschema
from django.conf import settings
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kpi.exceptions import UsageLimitExceededException
from kpi.utils.usage_calculator import ServiceUsageCalculator
from ..exceptions import InvalidItem
from ..time_utils import utc_datetime_to_js_str

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

@dataclass
class ActionClassConfig:
    """
    Defines how items in a result schema can be resolved.
        - key: the dictionary field used to identify or match an item (e.g., "language").
        - default_type: the default container type to return when no items exist
            (usually {} for objects or [] for arrays).
    """

    default_type: dict | list
    key: str | None
    automatic: bool


class BaseAction:

    DATE_CREATED_FIELD = '_dateCreated'
    DATE_MODIFIED_FIELD = '_dateModified'
    DATE_ACCEPTED_FIELD = '_dateAccepted'
    REVISIONS_FIELD = '_revisions'

    action_class_config: ActionClassConfig | None = None

    def __init__(self, source_question_xpath, params):
        self.source_question_xpath = source_question_xpath
        self.params = params

    def check_limits(self, user: User):

        if not settings.STRIPE_ENABLED or not self._is_usage_limited:
            return

        calculator = ServiceUsageCalculator(user)
        balances = calculator.get_usage_balances()

        balance = balances[self._limit_identifier]
        if balance and balance['exceeded']:
            raise UsageLimitExceededException()

    @property
    def automated_data_schema(self):
        raise NotImplementedError

    @property
    def data_schema(self):
        raise NotImplementedError

    def get_output_fields(self) -> list[dict]:
        """
        Returns a list of fields contributed by this action to outputted
        submission data as shown in exports, the table view UI, etc.

        For a manual transcription to French, this might look like:
            [
                {
                    'language': 'fr',
                    'name': 'group_name/question_name/transcript__fr',
                    'source': 'group_name/question_name',
                    'type': 'transcript',
                }
            ]

        Must be implemented by subclasses.
        """
        raise NotImplementedError()

    def validate_automated_data(self, data):
        jsonschema.validate(data, self.automated_data_schema)

    def validate_data(self, data):
        jsonschema.validate(data, self.data_schema)

    @classmethod
    def validate_params(cls, params):
        jsonschema.validate(params, cls.params_schema)

    def validate_result(self, result):
        jsonschema.validate(result, self.result_schema)

    @property
    def result_schema(self):
        """
        must be implemented by subclasses
        """
        raise NotImplementedError()

    def retrieve_data(self, action_data: dict) -> dict:
        """
        `action_data` must be ONLY the data for this particular action
        instance, not the entire SubmissionExtras caboodle

        subclasses could override with special manipulation if needed
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
        `submission` argument for future use by subclasses
        this method might need to be made more friendly for overriding
        """

        # Validate differently when automatic process ran, to allow internal fields
        # but block them from user input.
        if self.action_class_config.automatic:
            self.validate_automated_data(edit)
            accepted = edit.pop('accepted', None)
        else:
            self.validate_data(edit)
            accepted = True

        self.raise_for_any_leading_underscore_key(edit)

        now_str = utc_datetime_to_js_str(timezone.now())
        item_index = None
        submission_supplement_copy = deepcopy(submission_supplement)
        if not isinstance(self.action_class_config.default_type, list):
            revision = submission_supplement_copy
        else:
            needle = edit[self.action_class_config.key]
            revision = {}
            if not isinstance(submission_supplement, list):
                raise InvalidItem

            for idx, item in enumerate(submission_supplement):
                if needle == item[self.action_class_config.key]:
                    revision = deepcopy(item)
                    item_index = idx
                    break

        new_record = deepcopy(edit)
        revisions = revision.pop(self.REVISIONS_FIELD, [])

        revision_creation_date = revision.pop(self.DATE_MODIFIED_FIELD, now_str)
        record_creation_date = revision.pop(self.DATE_CREATED_FIELD, now_str)
        revision[self.DATE_CREATED_FIELD] = revision_creation_date
        new_record[self.DATE_MODIFIED_FIELD] = now_str

        # If the default type is not a list, we handle a single record case.
        if not isinstance(self.action_class_config.default_type, list):
            if submission_supplement:
                revisions.insert(0, revision)
                new_record[self.REVISIONS_FIELD] = revisions
        else:
            # When the default type is a list, we are handling an item within it.
            if item_index is not None:
                revisions.insert(0, revision)
                new_record[self.REVISIONS_FIELD] = revisions

        new_record[self.DATE_CREATED_FIELD] = record_creation_date

        # For manual actions, always mark as accepted.
        # For automatic actions, revert the just-created revision (remove it and
        # reapply its dates) to avoid adding extra branching earlier in the method.
        if self.action_class_config.automatic:
            if accepted is not None:
                revision = new_record[self.REVISIONS_FIELD].pop(0)
                if not len(new_record[self.REVISIONS_FIELD]):
                    del new_record[self.REVISIONS_FIELD]
                # reassign date
                new_record[self.DATE_MODIFIED_FIELD] = revision[self.DATE_CREATED_FIELD]
                if accepted:
                    new_record[self.DATE_ACCEPTED_FIELD] = now_str
        else:
            new_record[self.DATE_ACCEPTED_FIELD] = now_str

        if isinstance(self.action_class_config.default_type, list):
            # Handle the case where the default type is a list:
            # - If no index is provided, append the new record.
            # - Otherwise, replace the record at the given index.
            # Finally, update `new_record` to reference the full updated list.
            if item_index is None:
                submission_supplement_copy.append(new_record)
            else:
                submission_supplement_copy[item_index] = new_record

            new_record = submission_supplement_copy

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
                raise Exception('An unexpected key with a leading underscore was found')

    def run_automatic_process(self, submission: dict, submission_supplement: dict, edit: dict, *args, **kwargs):
        """
        Update edit with automatic process
        """
        raise NotImplementedError

    def _inject_data_schema(self, destination_schema: dict, skipped_keys: list):
        """
        Utility function to inject data schema into another schema to
        avoid repeating the same schema.
        Useful to produce result schema.
        """

        schema_to_inject = (
            self.automated_data_schema
            if self.action_class_config.automatic
            else self.data_schema
        )

        for key, value in schema_to_inject.items():
            if key in skipped_keys:
                continue

            if key in destination_schema:
                if isinstance(destination_schema[key], dict):
                    destination_schema[key].update(schema_to_inject[key])
                elif isinstance(destination_schema[key], list):
                    destination_schema[key].extend(schema_to_inject[key])
                else:
                    destination_schema[key] = schema_to_inject[key]
            else:
                destination_schema[key] = schema_to_inject[key]

    @property
    def _is_usage_limited(self):
        """
        Returns whether an action should check for usage limits.
        """
        return self.action_class_config.automatic

    @property
    def _limit_identifier(self):
        # See AutomaticGoogleTranscriptionAction._limit_identifier() for example
        raise NotImplementedError()
