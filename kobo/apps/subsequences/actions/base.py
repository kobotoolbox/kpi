import uuid
from copy import deepcopy
from dataclasses import dataclass

import jsonschema
from django.conf import settings
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.subsequences.utils.time import utc_datetime_to_js_str
from kpi.exceptions import UsageLimitExceededException
from kpi.utils.usage_calculator import ServiceUsageCalculator
from ..tasks import poll_run_automated_process
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
            # TODO: think about wrapping in language dictionary like translations
            '_dateCreated': '2025-08-21T20:55:42.012053Z',
            '_dateModified': '2025-08-21T20:57:28.154567Z',
            '_versions': [
                {
                    'value': 'هائج',
                    'language': 'ar',
                    '_dateCreated': '2025-08-21T20:57:28.154567Z',
                    '_dateAccepted': '2025-08-21T20:57:28.154567Z',
                    '_uuid': '4dcf9c9f-e503-4e5c-81f5-74250b295001',
                },
                {
                    'value': 'فارغ',
                    'language': 'ar',
                    '_dateCreated': '2025-08-21T20:55:42.012053Z',
                    '_dateAccepted': '2025-08-21T20:55:42.012053Z',
                    '_uuid': '850e6359-50e8-4252-9895-e9669a27b1ea',
                }
            ],
        },
        'manual_translation': {
                'es': {
                    '_dateCreated': '2025-08-21T21:39:42.141306Z',
                    '_dateModified': '2025-08-21T21:40:54.644308Z',
                    '_versions': [
                        {
                            'value': 'enloquecido',
                            'language': 'es',
                            '_dateCreated': '2025-08-21T21:40:54.644308Z',
                            '_dateAccepted': '2025-08-21T21:40:54.644308Z',
                            '_uuid': '22b04ce8-61c2-4383-836f-5d5f0ad73645',
                        },
                        {
                            'value': 'loco',
                            'language': 'es',
                            '_dateCreated': '2025-08-21T21:39:42.141306Z',
                            '_dateAccepted': '2025-08-21T21:39:42.141306Z',
                            '_uuid': '13403918-6b53-4222-8f8f-27397b53e2ce',
                        }
                    ],
                },
                'fr': {
                    '_dateCreated': '2025-08-21T22:00:10.862880Z',
                    '_dateModified': '2025-08-21T22:00:10.862880Z',
                    '_versions': [
                        {
                            'value': 'fou',
                            'language': 'fr',
                            '_dateCreated': '2025-08-21T22:00:10.862880Z',
                            '_dateAccepted': '2025-08-21T22:00:10.862880Z',
                            '_uuid': 'de6501fd-71c0-43fe-a569-b8407e50bc70',
                        }
                    ],
                }
            },
        ],
    },
    'my_video_question': {
        'manual_transcription': {
            '_dateCreated': '2025-08-21T21:06:20.059117Z',
            '_dateModified': '2025-08-21T21:06:20.059117Z',
            '_versions': [
                {
                    'value': 'sea horse sea hell',
                    'language': 'en',
                    '_dateCreated': '2025-08-21T21:06:20.059117Z',
                    '_dateAccepted': '2025-08-21T21:06:20.059117Z',
                    '_uuid': 'fec5a51d-bd12-4d61-86ba-c2e8507a2a93',
                }
            ],
        }
    },
    'my_number_question': {
        'number_multiplier': {
            '_dateCreated': '2025-08-21T21:09:34.504546Z',
            '_dateModified': '2025-08-21T21:09:34.504546Z',
            '_versions': [
                'value': 99,
                '_dateCreated': '2025-08-21T21:09:34.504546Z',
                '_uuid': '12345678-90ab-cdef-1234-567890abcdef',
            ],
        },
    },
}
"""


@dataclass
class ActionClassConfig:
    """
    Configuration for how items in a result schema are resolved.

    - allow_multiple: Whether multiple items can share the same `action_data_key`.
    - action_data_key: The field in `action_data` used to identify or match an item
      when multiple entries are allowed (e.g., "language").
    - automated: Indicates whether the action relies on an external service
      to generate data.
    """

    allow_multiple: bool
    automated: bool
    action_data_key: str | None = None


class BaseAction:

    ACTION_ID_FIELD = '_actionId'
    DATE_CREATED_FIELD = '_dateCreated'
    DATE_MODIFIED_FIELD = '_dateModified'
    DATE_ACCEPTED_FIELD = '_dateAccepted'
    DEPENDENCY_FIELD = '_dependency'
    UUID_FIELD = '_uuid'
    VERSION_FIELD = '_versions'

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
        question_supplemental_data: dict,
        action_supplemental_data: dict,
        action_data: dict,
        asset: 'kpi.models.Asset' = None,
    ) -> dict | None:
        """
        `submission` argument for future use by subclasses
        this method might need to be made more friendly for overriding
        """

        self.validate_data(action_data)
        self.raise_for_any_leading_underscore_key(action_data)

        now_str = utc_datetime_to_js_str(timezone.now())

        localized_action_supplemental_data = deepcopy(action_supplemental_data)
        if self.action_class_config.allow_multiple:
            # TODO: Multiple keys are not supported.
            #   Not a big issue for now since translation actions don’t use locale
            #   (yet?) and transcription actions only involve one occurrence at a time.
            needle = action_data[self.action_class_config.action_data_key]
            localized_action_supplemental_data = action_supplemental_data.get(needle, {})

        try:
            current_version = localized_action_supplemental_data.get(
                self.VERSION_FIELD, []
            )[0]
        except IndexError:
            current_version = {}

        if self.action_class_config.automated:
            # If the action is automated, run the external process first.
            if not (
                service_response := self.run_automated_process(
                    submission,
                    question_supplemental_data,
                    current_version,
                    action_data,
                    asset=asset,
                )
            ):
                # If the service response is None, the automated task is still running.
                # Stop here to avoid processing data and creating redundant revisions.
                return None

            # Otherwise, merge the service response into action_data and keep going
            # the validation process.

            dependency_supplemental_data = action_data.pop(self.DEPENDENCY_FIELD, None)
            # action_data = deepcopy(action_data)
            action_data.update(service_response)
            self.validate_automated_data(action_data)
            accepted = action_data.pop('accepted', None)
        else:
            dependency_supplemental_data = None
            accepted = True

        new_version = deepcopy(action_data)
        new_version[self.DATE_CREATED_FIELD] = now_str
        new_version[self.UUID_FIELD] = str(uuid.uuid4())
        if dependency_supplemental_data:
            new_version[self.DEPENDENCY_FIELD] = dependency_supplemental_data

        if self.DATE_CREATED_FIELD not in localized_action_supplemental_data:
            localized_action_supplemental_data[self.DATE_CREATED_FIELD] = now_str
        localized_action_supplemental_data[self.DATE_MODIFIED_FIELD] = now_str

        localized_action_supplemental_data.setdefault(
            self.VERSION_FIELD, []
        ).insert(0, new_version)

        # For manual actions, always mark as accepted.
        # For automated actions, revert the just-created revision (remove it and
        # reapply its dates) to avoid adding extra branching earlier in the method.
        if self.action_class_config.automated:
            if accepted is not None:
                # Remove stale version
                localized_action_supplemental_data[self.VERSION_FIELD].pop(0)
                if accepted:
                    localized_action_supplemental_data[self.VERSION_FIELD][0][
                        self.DATE_ACCEPTED_FIELD
                    ] = now_str
                else:
                    localized_action_supplemental_data[self.VERSION_FIELD][
                        0
                    ].pop(self.DATE_ACCEPTED_FIELD, None)

        else:
            new_version[self.DATE_ACCEPTED_FIELD] = now_str

        if not self.action_class_config.allow_multiple:
            new_action_supplement_data = localized_action_supplemental_data
        else:
            new_action_supplement_data = deepcopy(action_supplemental_data)
            # Handle the case where the default type is a list:
            # - If no index is provided, append the new record.
            # - Otherwise, replace the record at the given index.
            # Finally, update `new_record` to reference the full updated list.

            new_action_supplement_data.update({
                needle: localized_action_supplemental_data
            })

        self.validate_result(new_action_supplement_data)

        return new_action_supplement_data

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

    def run_automated_process(
        self,
        submission: dict,
        question_supplemental_data: dict,
        action_supplement_data: dict,
        action_data: dict,
        *args,
        **kwargs,
    ) -> dict | bool:
        """
        Update action_data with automated process
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
            if self.action_class_config.automated
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
        return self.action_class_config.automated

    @property
    def _limit_identifier(self):
        # See AutomatedGoogleTranscriptionAction._limit_identifier() for example
        raise NotImplementedError()


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
        The payload must be an object with:
          - language : required string, one of the allowed languages (e.g. "fr", "es")
          - value    : required string or null
          - locale   : optional string or null (e.g. "fr-CA", "es-ES")

        Examples
        --------
        # Minimal valid example (required fields only)
        {
            "language": "es",
            "value": "Almorzamos muy bien hoy"
        }

        # With explicit locale
        {
            "language": "fr",
            "locale": "fr-CA",
            "value": "Bonjour tout le monde"
        }

        # Null value is allowed when data is intentionally deleted
        {
            "language": "fr",
            "value": null
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


class BaseAutomatedNLPAction(BaseManualNLPAction):
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
          ["requested", "in_progress", "complete", "failed"].
        - If `status` == "complete":
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
        """ """

        raise NotImplementedError

    def run_automated_process(
        self,
        submission: dict,
        question_supplemental_data: dict,
        action_supplement_data: dict,
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
        if action_supplement_data.get('status') == 'complete' and accepted is not None:
            return {
                'value': action_supplement_data['value'],
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

        if hasattr(self, '_get_action_data_dependency'):
            action_data = self._get_action_data_dependency(
                question_supplemental_data, action_data
            )

        # Otherwise, trigger the external service.
        asset = kwargs['asset']
        NLPService = self.get_nlp_service_class()  # noqa
        service = NLPService(submission, asset=asset)
        service_data = service.process_data(self.source_question_xpath, action_data)

        # Sanitize 'dependency' before persisting: keep only stable identifiers and drop
        # all other fields (e.g., 'value', 'language', timestamps).
        if dependency := action_data.pop(self.DEPENDENCY_FIELD, None):
            action_data[self.DEPENDENCY_FIELD] = {
                self.ACTION_ID_FIELD: dependency[self.ACTION_ID_FIELD],
                self.UUID_FIELD: dependency[self.UUID_FIELD],
            }


        # If the request is still running, stop processing here.
        # Returning None ensures that `revise_data()` will not be called afterwards.
        if (
            accepted is None
            and service_data['status'] == 'in_progress'
        ):
            if action_supplement_data.get('status'):
                return None
            else:
                # TODO Retry with Celery, make it work!
                poll_run_automated_process.delay(
                    submission,
                    question_supplemental_data,
                    action_supplement_data,
                    action_data,
                    action_id=self.ID,
                    asset_id=asset.pk,
                )

        # Normal case: return the processed transcription data.
        return service_data
