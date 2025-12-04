from typing import Any

from .base import ActionClassConfig, BaseManualNLPAction
from .mixins import TranslationActionMixin


class ManualTranslationAction(TranslationActionMixin, BaseManualNLPAction):

    ID = 'manual_translation'
    action_class_config = ActionClassConfig(
        allow_multiple=True, automatic=False, action_data_key='language'
    )

    def transform_data_for_output(
        self, action_data: list[dict]
    ) -> dict[str, dict[str, Any]]:
        return {
            self._get_output_field_name(translation_data['language']): {
                'language': translation_data['language'],
                'value': translation_data['value'],
                '_dateAccepted': translation_data[self.DATE_MODIFIED_FIELD],
            }
            for translation_data in action_data
        }
