from kobo.apps.organizations.constants import UsageType
from ..integrations.google.google_translate import GoogleTranslationService
from ..type_aliases import NLPExternalServiceClass
from .base import ActionClassConfig, BaseAutomaticNLPAction
from .mixins import TranslationActionMixin


class AutomaticGoogleTranslationAction(TranslationActionMixin, BaseAutomaticNLPAction):

    ID = 'automatic_google_translation'
    action_class_config = ActionClassConfig(
        allow_multiple=True,
        automatic=True,
        action_data_key='language',
        requires_acceptance=True,
    )

    def get_nlp_service_class(self) -> NLPExternalServiceClass:
        return GoogleTranslationService

    @property
    def result_schema(self):
        """
        JSON Schema for automatic Google translation results.

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
          – must be absent when status is "deleted".
          – required when this status is any other status.

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
                "_data": {
                    "_uuid": "550e8400-e29b-41d4-a716-446655440000",
                    "language": "en",
                    "status": "in_progress"
                },
                "_dependency": {
                  "_uuid": "16fd2706-8baf-433b-82eb-8c7fada847da",
                  "_actionId": "automatic_google_transcription"
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
                "_data": {
                    "language": "en",
                    "locale": "en-CA",
                    "status": "complete",
                    "value": "Lunch was great today.",
                    "accepted": true
                },
                "_dependency": {
                  "_uuid": "16fd2706-8baf-433b-82eb-8c7fada847da",
                  "_actionId": "automatic_google_transcription"
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
                "_data": {
                    "language": "en",
                    "status": "failed",
                    "error": "Upstream service timeout."
                }
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
                "_data": {
                    "language": "en",
                    "status": "deleted",
                    "value": null
                }
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
                'enum': ['in_progress', 'complete', 'failed', 'deleted'],
            },
        }

        return schema

    @property
    def _limit_identifier(self):
        return UsageType.MT_CHARACTERS
