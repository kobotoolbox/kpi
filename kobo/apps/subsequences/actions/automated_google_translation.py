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

    def get_nlp_service_class(self) -> NLPExternalServiceClass:
        return GoogleTranslationService

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

    def _get_action_data_dependency(
        self, question_supplemental_data: dict, action_data: dict
    ) -> dict:
        """
        Attach the latest accepted transcript as a dependency for a translation action.

        Looks up prior transcription actions in `question_supplemental_data` and
        selects the most recent accepted version.
        The chosen transcript is injected into `action_data['dependency']` with:
          - 'value': transcript text
          - 'language': preferred locale if present, else base language
          - '_uuid': transcript UUID

        The search is restricted to known transcription action IDs (e.g., Google
        automated and manual transcription). If none is found, raises
        `TranscriptionNotFound`.
        """

        # Action IDs that can provide a transcript dependency.
        transcription_action_ids = (
            AutomatedGoogleTranscriptionAction.ID,
            ManualTranscriptionAction.ID,
        )

        latest_version = None
        latest_accepted_dt = None

        for action_id in transcription_action_ids:
            # Each action's data is expected to store versions under "_versions".
            action_supplemental_data = question_supplemental_data.get(action_id)
            if not action_supplemental_data:
                continue

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

        if latest_version is None:
            raise TranscriptionNotFound

        # Prefer a specific locale when available; otherwise use the base language.
        language_or_locale = (
            latest_version.get('locale') or latest_version['language']
        )

        # Inject dependency property for translation service
        action_data['dependency'] = {
            'value': latest_version['value'],
            'language': language_or_locale,
            self.UUID_FIELD: latest_version[self.UUID_FIELD],
        }

        return action_data

    @property
    def _limit_identifier(self):
        return UsageType.MT_CHARACTERS
