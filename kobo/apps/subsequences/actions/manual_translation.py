from typing import Any

from .base import ActionClassConfig, BaseManualNLPAction
from .mixins import TranslationResultSchemaMixin


class ManualTranslationAction(TranslationResultSchemaMixin, BaseManualNLPAction):

    ID = 'manual_translation'
    action_class_config = ActionClassConfig(
        allow_multiple=True, automated=False, action_data_key='language'
    )

    def _get_output_field_name(self, language: str) -> str:
        language = language.split('-')[0]  # ignore region if any
        return f'{self.source_question_xpath}/translation__{language}'

    def get_output_fields(self):
        return [
            {
                'language': params['language'],
                'name': self._get_output_field_name(params['language']),
                'source': self.source_question_xpath,
                'type': 'translation',
            }
            for params in self.params
        ]

    def transform_data_for_output(
        self, action_data: list[dict]
    ) -> dict[str, dict[str, Any]]:
        # keep next to `get_output_fields()` for now
        return {
            self._get_output_field_name(translation_data['language']): {
                'language': translation_data['language'],
                'value': translation_data['value'],
                '_dateAccepted': translation_data[self.DATE_MODIFIED_FIELD],
            }
            for translation_data in action_data
        }
