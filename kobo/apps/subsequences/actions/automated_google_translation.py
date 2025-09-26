from dateutil import parser

from kobo.apps.organizations.constants import UsageType
from ..actions.automated_google_transcription import AutomatedGoogleTranscriptionAction
from ..actions.manual_transcription import ManualTranscriptionAction
from ..exceptions import TranscriptionNotFound
from ..integrations.google.google_translate import GoogleTranslationService
from ..type_aliases import NLPExternalServiceClass
from .base import ActionClassConfig, BaseAutomatedNLPAction
from .mixins import TranslationResultSchemaMixin


class AutomatedGoogleTranslationAction(
    TranslationResultSchemaMixin, BaseAutomatedNLPAction
):

    ID = 'automated_google_translation'
    action_class_config = ActionClassConfig(
        allow_multiple=True, automated=True, action_data_key='language'
    )

    def attach_action_dependency(self, action_data: dict):
        """
        Attach the latest accepted transcript as a dependency for a translation action.

        Looks up prior transcription actions in `self._action_dependencies` and
        selects the most recent accepted version.
        The chosen transcript is injected into `action_data['dependency']` with:
          - 'value': transcript text
          - 'language': preferred locale if present, else base language
          - '_uuid': transcript UUID

        If none is found, raises `TranscriptionNotFound`.
        """

        latest_version = latest_accepted_dt = None

        for action_id, action_supplemental_data in self._action_dependencies.items():

            versions = action_supplemental_data.get(self.VERSION_FIELD) or []
            for version in versions:
                # Skip versions without an acceptance timestamp.
                accepted_raw = version.get(self.DATE_ACCEPTED_FIELD)
                if not accepted_raw:
                    continue

                accepted_dt = parser.parse(accepted_raw)

                if latest_accepted_dt is None or accepted_dt > latest_accepted_dt:
                    latest_accepted_dt = accepted_dt
                    latest_version = version
                    latest_version[self.ACTION_ID_FIELD] = action_id

        if latest_version is None:
            raise TranscriptionNotFound

        # Prefer a specific locale when available; otherwise use the base language.
        language_or_locale = (
            latest_version.get('locale') or latest_version['language']
        )

        # Inject dependency property for translation service
        action_data[self.DEPENDENCY_FIELD] = {
            'value': latest_version['value'],
            'language': language_or_locale,
            self.UUID_FIELD: latest_version[self.UUID_FIELD],
            self.ACTION_ID_FIELD: latest_version.pop(self.ACTION_ID_FIELD),
        }

        return action_data


    def get_nlp_service_class(self) -> NLPExternalServiceClass:
        return GoogleTranslationService

    def get_action_dependencies(self, question_supplemental_data: dict) -> dict:
        """
        Return only the supplemental data required by this action.

        This method inspects the full `question_supplemental_data` payload
        and extracts a subset containing only the actions on which the
        current action relies (e.g., transcription results needed before a
        translation).  It never mutates the original dictionary and does not
        include unrelated entries—only the minimal keys and values needed
        for this action to run correctly.
        """

        transcription_action_ids = (
            AutomatedGoogleTranscriptionAction.ID,
            ManualTranscriptionAction.ID,
        )

        for action_id in transcription_action_ids:

            action_supplemental_data = question_supplemental_data.get(action_id)
            if not action_supplemental_data:
                continue
            self._action_dependencies[action_id] = action_supplemental_data

        return self._action_dependencies

    @property
    def result_schema(self):
        """
        JSON Schema for automated Google translation results.

        The payload is an object where each top-level key is a language code from
        `self.languages` (e.g. "en") mapping to a dataActionKey object. Timestamps
        are ISO-8601 `date-time` strings (e.g. "2025-09-24T10:45:00Z").

        Validation rules for each version
        ----------------
        • _dateCreated : always required.
        • _uuid        : always required.
        • language     : always required.
        • status       : always required (one of: in_progress, complete, failed,
                         deleted).

        • value
          – required when status == "complete".
          – must be absent when status is "in_progress" or "failed".
          – may be absent or explicitly null when status == "deleted".

        • error
          – required when status == "failed".
          – must be absent for all other statuses.

        • accepted
          – allowed only when status == "complete".

        • _dependency
          – required when status is "complete" or "in_progress".
          – must be absent for any other status.

        Examples
        --------
        # In-progress (minimal)
        {
          "en": {
            "_dateCreated": "2025-09-24T10:45:00Z",
            "_dateModified": "2025-09-24T10:45:00Z",
            "_versions": [
              {
                "_dateCreated": "2025-09-24T10:45:00Z",
                "_uuid": "550e8400-e29b-41d4-a716-446655440000",
                "language": "en",
                "status": "in_progress",
                "_dependency": {
                  "_uuid": "16fd2706-8baf-433b-82eb-8c7fada847da",
                  "_actionId": "automated_google_transcription"
                }
              }
            ]
          }
        }

        # Complete (value required)
        {
          "en": {
            "_dateCreated": "2025-09-24T10:45:00Z",
            "_dateModified": "2025-09-24T10:45:00Z",
            "_versions": [
              {
                "_dateCreated": "2025-09-24T10:45:00Z",
                "_uuid": "4c0a0e9c-0f2c-4d8a-9c72-3a8d2f9a2a11",
                "language": "en",
                "locale": "en-CA",
                "status": "complete",
                "value": "Lunch was great today.",
                "accepted": true,
                "_dependency": {
                  "_uuid": "16fd2706-8baf-433b-82eb-8c7fada847da",
                  "_actionId": "automated_google_transcription"
                }
              }
            ]
          }
        }

        # Failed (error required)
        {
          "en": {
            "_dateCreated": "2025-09-24T10:45:00Z",
            "_dateModified": "2025-09-24T10:45:00Z",
            "_versions": [
              {
                "_dateCreated": "2025-09-24T10:45:00Z",
                "_uuid": "9b1deb4d-5b15-4e8f-9f8b-7b3f5c6e4d21",
                "language": "en",
                "status": "failed",
                "error": "Upstream service timeout."
              }
            ]
          }
        }

        # Deleted (value null or absent, no _dependency)
        {
          "en": {
            "_dateCreated": "2025-09-24T10:45:00Z",
            "_dateModified": "2025-09-24T10:45:00Z",
            "_versions": [
              {
                "_dateCreated": "2025-09-24T10:45:00Z",
                "_uuid": "7d444840-9dc0-11d1-b245-5ffdce74fad2",
                "language": "en",
                "status": "deleted",
                "value": null
              }
            ]
          }
        }
        """

        schema = super().result_schema

        # FIXME _inject_data_schema does not merge nested children
        schema['$defs']['action_status'] = {
            'action_status': {
                'type': 'string',
                'enum': ['in_progress', 'complete', 'error'],
            },
        }

        # Make "_dependency" property required if status is not deleted
        schema['$defs']['version']['properties'].update(
            {
                self.DEPENDENCY_FIELD: {
                    'type': 'object',
                    'additionalProperties': False,
                    'properties': {
                        self.UUID_FIELD: {'$ref': '#/$defs/uuid'},
                        self.ACTION_ID_FIELD: {'type': 'string'},
                    },
                    'required': [self.UUID_FIELD, self.ACTION_ID_FIELD],
                },
            }
        )
        schema['$defs']['version']['allOf'].append(
            {
                'if': {
                    'properties': {
                        'status': {'enum': ['complete', 'in_progress']}
                    },
                    'required': ['status']
                },
                'then': {
                    'required': [self.DEPENDENCY_FIELD]
                },
                'else': {
                    'not': {'required': [self.DEPENDENCY_FIELD]}
                }
            }
        )

        return schema

    @property
    def _limit_identifier(self):
        return UsageType.MT_CHARACTERS
