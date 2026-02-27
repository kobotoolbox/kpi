import uuid
from copy import deepcopy
from dataclasses import dataclass
from enum import Enum
from typing import Optional

import jsonschema
from constance import config
from django.conf import settings
from django.utils import timezone

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.subsequences.exceptions import (
    GoogleCloudStorageBucketNotFound,
    SubsequenceAcceptanceError,
    SubsequenceDeletionError,
    SubsequenceVerificationError,
)
from kobo.apps.subsequences.utils.time import utc_datetime_to_js_str
from kobo.celery import celery_app
from kpi.exceptions import UsageLimitExceededException
from kpi.utils.usage_calculator import ServiceUsageCalculator
from ..tasks import poll_run_external_process
from ..type_aliases import (
    NLPExternalServiceClass,
    SimplifiedOutputCandidatesByColumnKey,
)

"""
### All actions must have the following components

* (check!) a unique identifier for the action
* three jsonschemas:
  1. (check!) one to validate the parameters used to configure the action
    * `ADVANCED_FEATURES_PARAMS_SCHEMA`
  2. (check!) one to validate users' requests to invoke the action, which many contain
    content (e.g. a manual transcript)
    * the result of `modify_jsonschema()`
  3. one to validate the result of the action - the result of `modify_jsonschema()`
    * OH NO, this doesn't happen at all yet
* a handler that receives a submission (and other metadata) and processes it
"""

"""
idea of example content in asset.advanced_features (what kind of actions are activated
per question)
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

idea of example data in SubmissionSupplement based on the above
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


class ReviewType(Enum):
    # entries must be accepted before being part of the data set
    ACCEPTANCE = 'acceptance'
    # entries automatically become part of the data set with an additional column
    # showing whether they have been verified
    VERIFICATION = 'verification'


@dataclass
class ActionClassConfig:
    """
    Configuration for how items in a result schema are resolved.

    - allow_multiple: Whether multiple items can share the same `action_data_key`.
    - action_data_key: The field in `action_data` used to identify or match an item
      when multiple entries are allowed (e.g., "language").
    - automatic: Indicates whether the action relies on an external service
      to generate data.
    - review_type: How data is reviewed (verified or accepted)

    """

    allow_multiple: bool
    automatic: bool
    action_data_key: str | None = None
    review_type: ReviewType | None = None


class BaseAction:

    ACTION_ID_FIELD = '_actionId'
    DATE_CREATED_FIELD = '_dateCreated'
    DATE_MODIFIED_FIELD = '_dateModified'
    DATE_ACCEPTED_FIELD = '_dateAccepted'
    DEPENDENCY_FIELD = '_dependency'
    UUID_FIELD = '_uuid'
    VERSION_FIELD = '_versions'
    VERSION_DATA_FIELD = '_data'

    action_class_config: ActionClassConfig | None = None

    def __init__(
        self,
        source_question_xpath: str,
        params: list[dict],
        asset: Optional['kpi.models.Asset'] = None,
        prefetched_dependencies: dict = None,
    ):
        self.source_question_xpath = source_question_xpath
        self.validate_params(params)
        self.params = params
        self.asset = asset
        self._action_dependencies = prefetched_dependencies or {}

    def attach_action_dependency(self, action_data: dict):
        pass

    def check_limits(self, user: User):

        if (
            not settings.STRIPE_ENABLED
            or not self._is_usage_limited
            or not config.USAGE_LIMIT_ENFORCEMENT
        ):
            return

        calculator = ServiceUsageCalculator(user)
        balances = calculator.get_usage_balances()

        balance = balances[self._limit_identifier]
        if balance and balance['exceeded']:
            raise UsageLimitExceededException()

    @property
    def external_data_schema(self):
        raise NotImplementedError

    @property
    def data_schema(self):
        """
        Schema to validate payload POSTed to "/api/v2/assets/<asset uid>/data/<submission uuid>/supplemental"  # noqa
        """
        raise NotImplementedError

    def get_localized_action_supplemental_data(
        self, action_supplemental_data: dict, action_data: dict
    ) -> tuple[dict, str | None]:

        localized_action_supplemental_data = deepcopy(action_supplemental_data)
        needle = None

        if self.action_class_config.allow_multiple:
            # TODO: Multiple keys are not supported.
            #   Not a big issue for now since translation actions don’t use locale
            #   (yet?) and transcription actions only involve one occurrence at a time.
            needle = action_data[self.action_class_config.action_data_key]
            localized_action_supplemental_data = action_supplemental_data.get(
                needle, {}
            )

        return localized_action_supplemental_data, needle

    def get_new_action_supplemental_data(
        self,
        action_supplemental_data: dict,
        action_data: dict,
        dependency_supplemental_data: dict,
        accepted: bool | None = None,
        verified: bool | None = None,
    ) -> dict:
        now_str = utc_datetime_to_js_str(timezone.now())

        localized_action_supplemental_data, needle = (
            self.get_localized_action_supplemental_data(
                action_supplemental_data, action_data
            )
        )
        if 'value' in action_data or 'status' in action_data:
            new_version = {self.VERSION_DATA_FIELD: deepcopy(action_data)}
            new_version[self.DATE_CREATED_FIELD] = now_str
            new_version[self.UUID_FIELD] = str(uuid.uuid4())
            if self.action_class_config.review_type == ReviewType.VERIFICATION:
                # everything starts out unverified
                new_version['verified'] = False
            if dependency_supplemental_data:
                new_version[self.DEPENDENCY_FIELD] = dependency_supplemental_data
            localized_action_supplemental_data.setdefault(
                self.VERSION_FIELD, []
            ).insert(0, new_version)

        current_version = localized_action_supplemental_data[self.VERSION_FIELD][0]

        if (
            verified is not None
            and self.action_class_config.review_type == ReviewType.VERIFICATION
        ):
            current_version['verified'] = verified
            if verified:
                current_version['_dateVerified'] = now_str

        if (
            accepted is not None
            and self.action_class_config.review_type == ReviewType.ACCEPTANCE
        ):
            if accepted:
                current_version['_dateAccepted'] = now_str

        if self.DATE_CREATED_FIELD not in localized_action_supplemental_data:
            localized_action_supplemental_data[self.DATE_CREATED_FIELD] = now_str
        localized_action_supplemental_data[self.DATE_MODIFIED_FIELD] = now_str

        if not self.action_class_config.allow_multiple:
            new_action_supplemental_data = localized_action_supplemental_data
        else:
            new_action_supplemental_data = deepcopy(action_supplemental_data)
            new_action_supplemental_data.update(
                {needle: localized_action_supplemental_data}
            )
        self.validate_result(new_action_supplemental_data)

        return new_action_supplemental_data

    def get_output_fields(self) -> list[dict]:
        """
        Returns a list of fields contributed by this action to outputted
        submission data as shown in exports, the table view UI, etc.

        For a manual transcription to French, this might look like:
            [
                {
                    'language': 'fr',
                    'source': 'group_name/question_name',
                    'type': 'transcript',
                    'dtpath': f'group_name/question_name/transcript_fr',
                }
            ]

        Must be implemented by subclasses.
        """
        return []

    def transform_data_for_output(
        self, action_data: dict
    ) -> SimplifiedOutputCandidatesByColumnKey:
        """
        Given data retrieved by the action (eg the result of action.retrieve_data()),
        returns a dict of {data_key: formatted_value}

        data_key is a string or tuple representing the path to the value for a row,
        starting at the question level, in the eventual /data response
        e.g. 'transcript' for myquestion['transcript'], or ('translation','en') for
        myquestion['translation']['en']

        formatted_value is the simplified representation of the value along with the
        date accepted
        eg {
            'value': 'my transcribed string',
            'languageCode': 'en',
            '_dateAccepted': 2025-01-01T00:00:00Z}
        }
        """
        return {}

    def validate_external_data(self, data):
        jsonschema.validate(
            data,
            self.external_data_schema,
            format_checker=jsonschema.FormatChecker(),
        )

    def validate_data(self, data):
        jsonschema.validate(
            data, self.data_schema, format_checker=jsonschema.FormatChecker()
        )

    @classmethod
    def validate_params(cls, params):
        jsonschema.validate(
            params, cls.params_schema, format_checker=jsonschema.FormatChecker()
        )

    def validate_result(self, result):
        jsonschema.validate(
            result,
            self.result_schema,
            format_checker=jsonschema.FormatChecker(),
        )

    @property
    def result_schema(self):
        """
        must be implemented by subclasses
        """
        raise NotImplementedError()

    def retrieve_data(self, action_data: dict) -> dict:
        """
        `action_data` must be ONLY the data for this particular action
        instance, not the entire SubmissionSupplement caboodle

        subclasses could override with special manipulation if needed
        """
        return action_data

    def revise_data(
        self,
        submission: dict,
        action_supplemental_data: dict,
        action_data: dict,
    ) -> dict | None:
        """
        `submission` argument for future use by subclasses
        this method might need to be made more friendly for overriding
        """
        self.validate_data(action_data)
        self.raise_for_any_leading_underscore_key(action_data)

        localized_action_supplemental_data, _ = (
            self.get_localized_action_supplemental_data(
                action_supplemental_data, action_data
            )
        )

        # get what's currently in the supplemental data
        try:
            current_version = localized_action_supplemental_data.get(
                self.VERSION_FIELD, []
            )[0]
        except IndexError:
            current_version = {}
        self.attach_action_dependency(action_data)
        current_version_data = current_version.get(self.VERSION_DATA_FIELD, {})

        # cannot delete, verify, or accept non-existent data
        if current_version_data.get('value') is None:
            if 'value' in action_data and action_data['value'] is None:
                raise SubsequenceDeletionError
            if 'verified' in action_data:
                raise SubsequenceVerificationError()
            if 'accepted' in action_data:
                raise SubsequenceAcceptanceError()

        verified = action_data.pop('verified', None)
        accepted = action_data.pop('accepted', None)
        if verified is not None or accepted is not None:
            # if we're just verifying or accepting, no need to get more data
            dependency_supplemental_data = action_data.pop(self.DEPENDENCY_FIELD, None)
        elif self.action_class_config.automatic:
            # If the action is automatic, run the external process first
            if not (
                service_response := self.run_external_process(
                    submission,
                    current_version,
                    action_data,
                )
            ):
                # If the service response is None, the external task is still running.
                # Stop here to avoid processing data and creating redundant revisions.
                return None

            # Otherwise, merge the service response into action_data and keep going
            # the validation process.
            dependency_supplemental_data = action_data.pop(self.DEPENDENCY_FIELD, None)
            action_data.update(service_response)
            self.validate_external_data(action_data)
        else:
            # manual action
            dependency_supplemental_data = action_data.pop(self.DEPENDENCY_FIELD, None)
            # Deletion is triggered by passing `{value: null}`.
            # When this occurs, no acceptance should be recorded.
            accepted = (
                self.action_class_config.review_type == ReviewType.ACCEPTANCE
                and action_data.get('value') is not None
            )

        if dependency_supplemental_data:
            # Sanitize 'dependency' before persisting: keep only a reference of the
            # dependency (with '_actionId' and '_uuid') and drop all other fields
            # (e.g., 'value', 'language', timestamps).
            dependency_supplemental_data = {
                self.ACTION_ID_FIELD: dependency_supplemental_data[
                    self.ACTION_ID_FIELD
                ],
                self.UUID_FIELD: dependency_supplemental_data[self.UUID_FIELD],
            }

        return self.get_new_action_supplemental_data(
            action_supplemental_data,
            action_data,
            dependency_supplemental_data,
            accepted,
            verified,
        )

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

    def run_external_process(
        self,
        submission: dict,
        action_supplemental_data: dict,
        action_data: dict,
        *args,
        **kwargs,
    ) -> dict | bool:
        """
        Update action_data with external process
        """
        raise NotImplementedError

    def update_params(self, incoming_params):
        """
        Returns the result of updating current params with incoming ones from
        a request. May be overridden, eg, to prevent deletion of existing lanugages
        for transcriptions/translations
        Defaults to replacing the existing params with the new ones.
        Should raise an error if the incoming params are not well-formatted
        """
        self.validate_params(incoming_params)
        self.params = incoming_params

    def _get_date_field_value(self, version: dict) -> str:
        """
        Return the date used to sort a version.

        If `_data.value` is None, the action was deleted, so the creation date
        (`_dateCreated`) is used. Otherwise, the acceptance date (`_dateAccepted`)
        is used.
        """

        return (
            version.get(self.DATE_CREATED_FIELD, '')
            if 'value' in version[self.VERSION_DATA_FIELD]
            and version[self.VERSION_DATA_FIELD]['value'] is None
            else version.get(self.DATE_ACCEPTED_FIELD, '')
        )

    def _inject_data_schema(self, destination_schema: dict, skipped_keys: list):
        raise Exception('This method is going away')
        """
        Utility function to inject data schema into another schema to
        avoid repeating the same schema.
        Useful to produce result schema.
        """

        schema_to_inject = (
            self.external_data_schema
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

    def _get_output_field_dtpath(self, language: str) -> str:
        language = language.split('-')[0]  # ignore region if any
        return f'{self.source_question_xpath}/{self.col_type}_{language}'

    @property
    def col_type(self):
        raise NotImplementedError

    def get_output_fields(self):
        fields = []
        for params in self.params:
            language = params['language']
            col_type = self.col_type
            column = {
                'language': language,
                'source': self.source_question_xpath,
                'type': col_type,
                'name': self._get_output_field_dtpath(language),
                # TODO: expunge `dtpath`, which is now just the same thing as
                # `name` with a cryptic moniker. commit 4006bbd37 put `dtpath`
                # back (and removed `name`) to get restore functionality to the
                # data table, but the preferred solution would be changing the
                # frontend to use `name` instead of `dtpath`
                'dtpath': self._get_output_field_dtpath(language),
            }
            fields.append(column)
        return fields

    @property
    def languages(self) -> list[str]:
        languages = []
        for individual_params in self.params:
            languages.append(individual_params['language'])
        return languages

    def update_params(self, incoming_params):
        self.validate_params(incoming_params)
        current_languages = self.languages
        for language_obj in incoming_params:
            if language_obj['language'] not in current_languages:
                self.params.append(language_obj)


class BaseAutomaticNLPAction(BaseManualNLPAction):
    """
    Base class for all automatic NLP actions.

    Extends `BaseManualNLPAction`, reusing its `params_schema` for
    consistency in language configuration, while adding automatic-specific
    schema definitions (`external_data_schema` and `data_schema`).

    This ensures that both manual and automatic actions share the same
    validation rules for parameters, while automatic actions introduce
    their own structure with additional system-generated fields.
    """

    @property
    def external_data_schema(self) -> dict:
        """
        Schema rules:

        - The field `status` is always required and must be one of:
          ["in_progress", "complete", "failed"].
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
                # If status == "deleted" → "value" optional,
                # but if present it MUST be null
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
                # If status == "complete" → accepted allowed but optional;
                # else forbid it
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
        - `value` is optional but, if present, it MUST be `null`
           (no other type allowed).
        - `accepted` is optional.
        - Mutual exclusion: `accepted` and `value` cannot be present at the same time.
          * If `value` is present (and thus equals null), `accepted` must be absent.
          * If `accepted` is present, `value` must be absent.
        - No additional properties are allowed beyond:
          `language`, `locale`, `value`, `accepted`.
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
                'accepted': {'const': True},
                # Only null is permitted for `value`
                'value_null_only': {'type': 'null'},
            },
        }

    def get_nlp_service_class(self) -> NLPExternalServiceClass:
        """ """

        raise NotImplementedError

    def run_external_process(
        self,
        submission: dict,
        action_supplemental_data: dict,
        action_data: dict,
        *args,
        **kwargs,
    ) -> dict | None:
        """
        Run the automatic NLP process using the configured external service
        (e.g., Google).
        This method is intended to be called by `revise_data()`, which finalizes
        the validation and merging of `action_data`.
        The underlying service is expected to implement a `process_data()` method
        returning a dictionary with one of the following shapes:

            {'status': 'in_progress'}
            {'status': 'failed', 'error': '<error message>'}
            {'status': 'complete', 'value': '<result>'}

        Behavior:
        - If the service reports `in_progress`, the method returns `None` so that
          `revise_data()` can exit early and avoid redundant processing.
        - If the service returns `failed` or `complete`, the processed result is
          returned and passed back to `revise_data()`.
        """

        current_version = action_supplemental_data.get(self.VERSION_DATA_FIELD, {})

        # If the client explicitly removed a previously stored result,
        # preserve that deletion by returning a `deleted` status instead
        # of reprocessing the data with the external service.
        #
        # An empty string is not considered a deletion.
        # JSON Schema validation will later enforce that `value` is None.
        if 'value' in action_data:
            return {
                'value': action_data['value'],
                'status': 'deleted',
            }

        # Otherwise, trigger the external service.
        NLPService = self.get_nlp_service_class()  # noqa
        try:
            service = NLPService(submission, asset=self.asset)
        except GoogleCloudStorageBucketNotFound:
            return {'status': 'failed', 'error': 'GS_BUCKET_NAME not configured'}

        service_data = service.process_data(self.source_question_xpath, action_data)

        # If the request is still running, stop processing here.
        # Returning None ensures that `revise_data()` will not be called afterwards.
        if service_data['status'] == 'in_progress':
            if current_version.get('status') == 'in_progress':
                return None
            else:
                # Make Celery update in the background.
                # Since Celery is calling the same code, we want to ensure
                #  it does not recall itself.
                if not celery_app.current_worker_task:

                    celery_action_data = deepcopy(action_data)
                    celery_action_data.pop(self.DEPENDENCY_FIELD, None)

                    poll_run_external_process.apply_async(
                        kwargs={
                            'submission': submission,
                            'action_data': celery_action_data,
                            'action_id': self.ID,
                            'asset_id': self.asset.pk,
                            'question_xpath': self.source_question_xpath,
                        },
                        countdown=10,  # Give it a small delay before retrying
                    )

        # Normal case: return the processed transcription data.
        return service_data
