from kobo.apps.organizations.constants import UsageType
from ..integrations.google.google_transcribe import GoogleTranscriptionService
from ..type_aliases import NLPExternalServiceClass
from .base import ActionClassConfig, BaseAutomaticNLPAction
from .mixins import TranscriptionActionMixin


class AutomaticGoogleTranscriptionAction(
    TranscriptionActionMixin, BaseAutomaticNLPAction
):

    ID = 'automatic_google_transcription'
    action_class_config = ActionClassConfig(
        allow_multiple=False, automatic=True, allow_async=True
    )

    def get_nlp_service_class(self) -> NLPExternalServiceClass:
        return GoogleTranscriptionService

    @property
    def result_schema(self):
        """
        JSON Schema for automatic Google transcription results.

        The payload is a single-language object with:
          - _dateCreated : required string (date-time)
          - _dateModified: required string (date-time)
          - _versions    : array of version objects

        Validation rules for each version
        ----------------
        • _dateCreated : always required.
        • _uuid        : always required.
        • language     : always required.
        • status       : always required (in_progress, complete, failed, deleted).

        • value
          – required when status == "complete" (holds the transcript).
          – must be absent when status is "in_progress" or "failed".
          – may be absent or explicitly null when status == "deleted".

        • error
          – required when status == "failed".
          – must be absent for all other statuses.

        • accepted
          – allowed only when status == "complete".

        Examples
        --------
        # In-progress (minimal)
        {
          "_dateCreated": "2025-09-24T10:45:00Z",
          "_dateModified": "2025-09-24T10:45:00Z",
          "_versions": [
            {
              "_dateCreated": "2025-09-24T10:45:00Z",
              "_uuid": "550e8400-e29b-41d4-a716-446655440000",
              "language": "en",
              "status": "in_progress"
            }
          ]
        }

        # Complete (value required)
        {
          "_dateCreated": "2025-09-24T10:45:00Z",
          "_dateModified": "2025-09-24T10:45:00Z",
          "_versions": [
            {
              "_dateCreated": "2025-09-24T10:45:00Z",
              "_dateAccepted": "2025-09-24T10:46:10Z",
              "_uuid": "4c0a0e9c-0f2c-4d8a-9c72-3a8d2f9a2a11",
              "language": "en",
              "locale": "en-CA",
              "status": "complete",
              "value": "Lunch was great today.",
              "accepted": true
            }
          ]
        }

        # Failed (error required, no value)
        {
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

        # Deleted (value null or absent)
        {
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
        return UsageType.ASR_SECONDS
