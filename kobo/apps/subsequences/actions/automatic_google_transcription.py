from kobo.apps.organizations.constants import UsageType
from ..integrations.google.google_transcribe import GoogleTranscriptionService
from .base import ActionClassConfig, BaseAutomaticNLPAction
from .mixins import TranscriptionResultSchemaMixin
from ..type_aliases import NLPExternalServiceClass


class AutomaticGoogleTranscriptionAction(
    TranscriptionResultSchemaMixin, BaseAutomaticNLPAction
):

    ID = 'automatic_google_transcription'
    action_class_config = ActionClassConfig({}, None, True)

    def get_nlp_service_class(self) -> NLPExternalServiceClass:
        return GoogleTranscriptionService

    @property
    def result_schema(self):
        schema = super().result_schema

        # FIXME _inject_data_schema does not merge nested children
        schema['$defs']['action_status'] = {
            'action_status': {
                'type': 'string',
                'enum': ['in_progress', 'complete', 'error'],
            },
        }
        return schema

    @property
    def _limit_identifier(self):
        return UsageType.ASR_SECONDS
