from copy import deepcopy
from dataclasses import dataclass

import jsonschema
from django.conf import settings
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kpi.exceptions import UsageLimitExceededException
from kpi.utils.usage_calculator import ServiceUsageCalculator
from ..exceptions import InvalidItem
from kobo.apps.subsequences.utils.time import utc_datetime_to_js_str
from ..type_aliases import NLPExternalServiceClass


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
        """
        Schema to validate payload POSTed to "/api/v2/assets/<asset uid>/data/<submission uuid>/supplemental"  # noqa
        """
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
        self,
        submission: dict,
        submission_supplement: dict,
        action_data: dict,
        asset: 'kpi.models.Asset' = None,
    ) -> dict | None:
        """
        `submission` argument for future use by subclasses
        this method might need to be made more friendly for overriding
        """

        self.validate_data(action_data)
        self.raise_for_any_leading_underscore_key(action_data)

        if self.action_class_config.automatic:
            # If the action is automatic, run the external process first.
            if not (
                service_response := self.run_automated_process(
                    submission,
                    submission_supplement,
                    action_data,
                    asset=asset,
                )
            ):
                # If the service response is None, the automatic task is still running.
                # Stop here to avoid processing data and creating redundant revisions.
                return None

            # Otherwise, merge the service response into action_data and keep going
            # the validation process.
            action_data = deepcopy(action_data)
            action_data.update(service_response)
            self.validate_automated_data(action_data)
            accepted = action_data.pop('accepted', None)
        else:
            accepted = True

        now_str = utc_datetime_to_js_str(timezone.now())
        item_index = None
        submission_supplement_copy = deepcopy(submission_supplement)
        if not isinstance(self.action_class_config.default_type, list):
            revision = submission_supplement_copy
        else:
            # TODO: Multiple keys are not supported.
            #   Not a big issue for now since translation actions don’t use locale
            #   (yet?) and transcription actions only involve one occurrence at a time.
            needle = action_data[self.action_class_config.key]
            revision = {}
            if not isinstance(submission_supplement, list):
                raise InvalidItem

            for idx, item in enumerate(submission_supplement):
                if needle == item[self.action_class_config.key]:
                    revision = deepcopy(item)
                    item_index = idx
                    break

        new_record = deepcopy(action_data)
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

    def _run_automated_process(
        self,
        submission: dict,
        submission_supplement: dict,
        action_data: dict,
        *args,
        **kwargs,
    ) -> dict | bool:
        """
        Update action_data with automatic process
        """
        raise NotImplementedError


class BaseManualNLPAction(BaseAction):
    """
    Base class for all manual NLP actions.

    It defines a common `params_schema` that describes the set of languages
    configured in `Asset.advanced_features`. For example, if an audio
    question `my_audio_question` is transcribed into three languages, the
    schema may look like:

     'my_audio_question': {
         'language_action_id': [
             {'language': 'ar'},
             {'language': 'bn'},
             {'language': 'es'},
         ],
     }

    Each element in `params_schema` is an object with a single `language`
    property, enforcing the expected shape of the configuration.

    The `data_schema` property defines the JSON payload expected when
    posting supplemental data for a submission. This includes the
    transcription or translation result, identified by language and
    optionally by locale.
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
    def data_schema(self):
        """
        POST to "/api/v2/assets/<asset uid>/data/<submission uuid>/supplemental/"
        {
            'language_action_id': {
                'language': 'es',
                'locale': 'es-ES',
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
                'locale': {'$ref': '#/$defs/locale'},
                'value': {'$ref': '#/$defs/value'},
            },
            'required': ['language', 'value'],
            '$defs': {
                'lang': {'type': 'string', 'enum': self.languages},
                'value': {'type': ['string', 'null']},
                'locale': {'type': ['string', 'null']},
            },
        }

    @property
    def languages(self) -> list[str]:
        languages = []
        for individual_params in self.params:
            languages.append(individual_params['language'])
        return languages


class BaseAutomaticNLPAction(BaseManualNLPAction):
    """
    Base class for all automated NLP actions.

    Extends `BaseManualNLPAction`, reusing its `params_schema` for
    consistency in language configuration, while adding automated-specific
    schema definitions (`automated_data_schema` and `data_schema`).

    This ensures that both manual and automated actions share the same
    validation rules for parameters, while automated actions introduce
    their own structure for system-generated results.
    """

    @property
    def automated_data_schema(self) -> dict:
        """
        Schema rules:

        - The field `status` is always required and must be one of:
          ["requested", "in_progress", "completed", "failed"].
        - If `status` == "done":
            * The field `value` becomes required and must be a string.
        - If `status` == "failed":
            * The field `error` becomes required and must be a string.
        - No additional properties are allowed beyond `language`, `status` and `value`.
        """
        return {
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                'language': {'$ref': '#/$defs/lang'},
                'locale': {'$ref': '#/$defs/locale'},
                'status': {'$ref': '#/$defs/action_status'},
                'value': {'$ref': '#/$defs/value'},
                'error': {'$ref': '#/$defs/error'},
                'accepted': {'$ref': '#/$defs/accepted'},
            },
            'required': ['language', 'status'],
            'allOf': [
                # value is required when status == "complete"
                {'$ref': '#/$defs/rule_value_required_when_complete'},
                # value must be absent when status in {"in_progress","failed"}
                {'$ref': '#/$defs/rule_value_forbidden_when_in_progress_or_failed'},
                # value is optional but must be null when status == "deleted"
                {'$ref': '#/$defs/rule_value_null_only_when_deleted'},
                # error must be present iff status == "failed"
                {'$ref': '#/$defs/rule_error_presence_when_failed'},
                # accepted allowed only when status == "complete" (optional)
                {'$ref': '#/$defs/rule_accepted_only_when_complete'},
            ],
            '$defs': {
                'lang': {'type': 'string', 'enum': self.languages},
                'locale': {'type': ['string', 'null']},
                'action_status': {
                    'type': 'string',
                    'enum': ['in_progress', 'complete', 'failed', 'deleted'],
                },
                'value': {'type': ['string', 'null']},
                'error': {'type': 'string'},
                'accepted': {'type': 'boolean'},
                # --- Value rules ---
                # If status == "complete" → require "value" (string or null)
                'rule_value_required_when_complete': {
                    'if': {
                        'required': ['status'],
                        'properties': {'status': {'const': 'complete'}},
                    },
                    'then': {'required': ['value']},
                },
                # If status in {"in_progress","failed"} → forbid "value"
                'rule_value_forbidden_when_in_progress_or_failed': {
                    'if': {
                        'required': ['status'],
                        'properties': {'status': {'enum': ['in_progress', 'failed']}},
                    },
                    'then': {'not': {'required': ['value']}},
                },
                # If status == "deleted" → "value" optional, but if present it MUST be null
                'rule_value_null_only_when_deleted': {
                    'if': {
                        'required': ['status'],
                        'properties': {'status': {'const': 'deleted'}},
                    },
                    'then': {
                        'anyOf': [
                            {'not': {'required': ['value']}},  # value absent
                            {  # value present and null
                                'properties': {'value': {'type': 'null'}},
                                'required': ['value'],
                            },
                        ]
                    },
                },
                # --- Other field rules ---
                # If status == "failed" → require "error"; else forbid it
                'rule_error_presence_when_failed': {
                    'if': {
                        'required': ['status'],
                        'properties': {'status': {'const': 'failed'}},
                    },
                    'then': {'required': ['error']},
                    'else': {'not': {'required': ['error']}},
                },
                # If status == "complete" → accepted allowed but optional; else forbid it
                'rule_accepted_only_when_complete': {
                    'if': {
                        'required': ['status'],
                        'properties': {'status': {'const': 'complete'}},
                    },
                    'then': {},  # optional
                    'else': {'not': {'required': ['accepted']}},
                },
            },
        }

    @property
    def data_schema(self) -> dict:
        """
        Schema rules:

        - `language` is required.
        - `value` is optional but, if present, it MUST be `null` (no other type allowed).
        - `accepted` is optional.
        - Mutual exclusion: `accepted` and `value` cannot be present at the same time.
          * If `value` is present (and thus equals null), `accepted` must be absent.
          * If `accepted` is present, `value` must be absent.
        - No additional properties are allowed beyond: `language`, `locale`, `value`, `accepted`.
        """
        return {
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                'language': {'$ref': '#/$defs/lang'},
                'locale': {'$ref': '#/$defs/locale'},
                'value': {'$ref': '#/$defs/value_null_only'},
                'accepted': {'$ref': '#/$defs/accepted'},
            },
            'required': ['language'],
            'allOf': [
                # Forbid having both `accepted` and `value` at the same time
                {'not': {'required': ['accepted', 'value']}},
            ],
            '$defs': {
                'lang': {'type': 'string', 'enum': self.languages},
                'locale': {'type': ['string', 'null']},
                'accepted': {'type': 'boolean'},
                # Only null is permitted for `value`
                'value_null_only': {'type': 'null'},
            },
        }

    def get_nlp_service_class(self) -> NLPExternalServiceClass:
        """

        """

        raise NotImplementedError


    def run_automated_process(
        self,
        submission: dict,
        submission_supplement: dict,
        action_data: dict,
        *args,
        **kwargs,
    ) -> dict | None:
        """
        Run the automated NLP process using the configured external service
        (e.g., Google).
        This method is intended to be called by `revise_data()`, which finalizes
        the validation and merging of `action_data`.
        The underlying service is expected to implement a `process_data()` method
        returning a dictionary with one of the following shapes:

            {'status': 'in_progress'}
            {'status': 'failed', 'error': '<error message>'}
            {'status': 'complete', 'value': '<result>'}

        Behavior:
        - If the user explicitly accepted the last completed result, the method
          short-circuits and returns it immediately.
        - If the service reports `in_progress`, the method returns `None` so that
          `revise_data()` can exit early and avoid redundant processing.
        - If the service returns `failed` or `complete`, the processed result is
          returned and passed back to `revise_data()`.
        """

        # If the client sent "accepted" while the supplement is already complete,
        # return the completed translation/transcription right away. `revise_data()`
        # will handle the merge and final validation of this acceptance.
        accepted = action_data.get('accepted', None)
        if submission_supplement.get('status') == 'complete' and accepted is not None:
            return {
                'value': submission_supplement['value'],
                'status': 'complete',
            }

        # If the client explicitly removed a previously stored result,
        # preserve the deletion by returning a `deleted` status instead
        # of reprocessing with the automated service.
        if 'value' in action_data:
            return {
                'value': action_data['value'],
                'status': 'deleted',
            }

        # Otherwise, trigger the external service.
        NLPService = self.get_nlp_service_class()  # noqa
        service = NLPService(submission, asset=kwargs['asset'])
        service_data = service.process_data(self.source_question_xpath, action_data)

        # If the request is still running, stop processing here.
        # Returning None ensures that `revise_data()` will not be called afterwards.
        if (
            accepted is None
            and submission_supplement.get('status')
            == service_data['status']
            == 'in_progress'
        ):
            return None

        # Normal case: return the processed transcription data.
        return service_data
