from copy import deepcopy

from dateutil import parser

from kobo.apps.organizations.constants import UsageType
from ..integrations.google.google_translate import GoogleTranslationService
from .base import ActionClassConfig, BaseAutomaticNLPAction
from .mixins import TranslationResultSchemaMixin
from ..type_aliases import NLPExternalServiceClass
from ..exceptions import TranscriptionNotFound

class AutomaticGoogleTranslationAction(
    TranslationResultSchemaMixin, BaseAutomaticNLPAction
):

    ID = 'automatic_google_translation'
    action_class_config = ActionClassConfig([], 'language', True)

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
        Retrieve and attach dependency data from another transcription action.

        This method searches `question_supplemental_data` for the most recent
        transcription matching the base language of `action_data`. Regional
        variants are not supported: only the language code is used to locate
        the transcript. The found transcript (and locale if available) is then
        added to `action_data` under the `transcript` field.
        """

        # Avoid circular imports
        from ..actions import TRANSCRIPTION_ACTION_IDS_TO_CLASSES

        transcript = transcript_language = None
        last_date_modified = None

        # TODO Should we search only for accepted transcriptions?
        for action_id in TRANSCRIPTION_ACTION_IDS_TO_CLASSES.keys():
            try:
                question_supplemental_data[action_id]['value']
            except KeyError:
                continue

            action_version = question_supplemental_data[action_id]
            dependency_date_modified = parser.parse(
                action_version[self.DATE_MODIFIED_FIELD]
            )

            if (
                not last_date_modified
                or last_date_modified < dependency_date_modified
            ):
                last_date_modified = dependency_date_modified
                transcript = action_version['value']
                transcript_language = (
                    action_version.get('locale') or action_version['language']
                )

        if transcript is None:
            raise TranscriptionNotFound

        # Inject dependency property for translation service
        action_data['dependency'] = {
            'value': transcript,
            'language': transcript_language,
        }

        return action_data


    @property
    def _limit_identifier(self):
        return UsageType.MT_CHARACTERS
