from ..constants import TRANSCRIBABLE_SOURCE_TYPES
from ..actions.base import BaseAction, ACTION_NEEDED, PASSES

PENDING = 'PENDING'


class ManualTranscriptionAction(BaseAction):
    ID = 'manual_transcription'

    @classmethod
    def build_params(kls, survey_content):
        possible_transcribed_fields = []
        for row in survey_content.get('survey', []):
            if row['type'] in TRANSCRIBABLE_SOURCE_TYPES:
                possible_transcribed_fields.append(row['name'])
        params = {'values': possible_transcribed_fields}
        return params

    def load_params(self, params):
        self.possible_transcribed_fields = params['values']

    def check_submission_status(self, submission):
        if self._destination_field not in submission:
            return ACTION_NEEDED
        supp_data = submission[self._destination_field]

        # needs to be built out
        return PASSES
