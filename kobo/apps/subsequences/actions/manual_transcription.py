from ..actions.base import BaseAction, ACTION_NEEDED, PASSES

PENDING = 'PENDING'


class ManualTranscriptionAction(BaseAction):
    ID = 'manual_transcription'

    @classmethod
    def build_params(cls, content, **kwargs):
        possible_transcribed_fields = []
        for row in content.get('survey', []):
            if row['type'] in ['audio', 'video']:
                possible_transcribed_fields.append(cls.get_name(row))
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
