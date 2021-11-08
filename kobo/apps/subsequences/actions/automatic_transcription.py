from ..actions.base import BaseAction, ACTION_NEEDED, PASSES

NOT_REQUESTED = 'NOT_REQUESTED'
REQUESTED_BY_USER = 'REQUESTED_BY_USER'
PENDING = 'PENDING'

class AutomaticTranscriptionAction(BaseAction):
    ID = 'automatic_transcription'
    TRANSCRIPTION_SERVICES = []

    @classmethod
    def build_params(kls, survey_content):
        audio_questions = []
        possible_transcribed_fields = []
        for row in survey_content.get('survey', []):
            if row['type'] in ['audio', 'video']:
                possible_transcribed_fields.append(row['name'])
        params = {'values': possible_transcribed_fields, 'services': kls.TRANSCRIPTION_SERVICES}
        return params
    
    def load_params(self, params):
        self.possible_transcribed_fields = params['values']
        self.available_services = params['services']
    
    def check_submission_status(self, submission):
        if self._destination_field not in submission:
            return ACTION_NEEDED
        supp_data = submission[self._destination_field]

        for (fiels, service, fs_key) in self.field_service_matrix():
            if fs_key not in supp_data:
                return ACTION_NEEDED
            status = supp_data.get(fs_key)
            if status == REQUESTED_BY_USER:
                return ACTION_NEEDED
        return PASSES
    
    def field_service_matrix(self):
        for field in self.possible_transcribed_fields:
            for service in self.available_services:
                fs_key = f'{field}_transcription_{service}'
                yield (field, service, fs_key)

    def run_change(self, submission):
        supp_data = submission.get(self._destination_field, {})
        for field, service, fs_key in self.field_service_matrix():
            if fs_key not in supp_data:
                supp_data[fs_key] = NOT_REQUESTED
                continue
            field_service_status = supp_data[fs_key]
            if field_service_status == REQUESTED_BY_USER:
                self.initiate_async_request(submission, field, service)
                supp_data[fs_key] = PENDING
                continue
        return {**submission, self._destination_field: supp_data}
            
    def initiate_async_request(self, submission, field, service):
        print(f'INITIATE ASYNC REQUEST for {field} and {service}')
        pass

