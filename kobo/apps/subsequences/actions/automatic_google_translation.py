from kobo.apps.organizations.constants import UsageType
from ..integrations.google.google_translate import GoogleTranslationService
from .base import ActionClassConfig, BaseAutomaticNLPAction
from .mixins import TranslationResultSchemaMixin
from ..type_aliases import NLPExternalServiceClass


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

    @property
    def _limit_identifier(self):
        return UsageType.MT_CHARACTERS
