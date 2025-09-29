from typing import Any

from .base import ActionClassConfig, BaseManualNLPAction
from .mixins import TranscriptionActionMixin


class ManualTranscriptionAction(TranscriptionActionMixin, BaseManualNLPAction):

    ID = 'manual_transcription'
    action_class_config = ActionClassConfig(allow_multiple=False, automated=False)

    def _get_output_field_name(self, language: str) -> str:
        language = language.split('-')[0]  # ignore region if any
        return f'{self.source_question_xpath}/transcription__{language}'

    def get_output_fields(self) -> list[dict]:
        return [
            {
                'language': params['language'],
                'name': self._get_output_field_name(params['language']),
                'source': self.source_question_xpath,
                'type': 'transcript',
            }
            for params in self.params
        ]

    def transform_data_for_output(self, action_data: dict) -> dict[str, dict[str, Any]]:
        # keep next to `get_output_fields()` for now

        # Sir, there's only one current transcript per response
        return {
            self._get_output_field_name(action_data['language']): {
                'language': action_data['language'],
                'value': action_data['value'],
                self.DATE_ACCEPTED_FIELD: action_data[self.DATE_MODIFIED_FIELD],
            }
        }
