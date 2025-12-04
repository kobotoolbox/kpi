from typing import Any

from .base import ActionClassConfig, BaseManualNLPAction
from .mixins import TranscriptionActionMixin


class ManualTranscriptionAction(TranscriptionActionMixin, BaseManualNLPAction):

    ID = 'manual_transcription'
    action_class_config = ActionClassConfig(allow_multiple=False, automatic=False)

    def transform_data_for_output(self, action_data: dict) -> dict[str, dict[str, Any]]:
        # Sir, there's only one current transcript per response
        return {
            self._get_output_field_name(action_data['language']): {
                'language': action_data['language'],
                'value': action_data['value'],
                self.DATE_ACCEPTED_FIELD: action_data[self.DATE_MODIFIED_FIELD],
            }
        }
