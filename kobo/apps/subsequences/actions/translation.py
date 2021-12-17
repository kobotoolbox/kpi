from ..actions.base import BaseAction, ACTION_NEEDED, PASSES


class TranslationAction(BaseAction):
    ID = 'translation'

    @classmethod
    def build_params(kls, survey_content):
        audio_questions = []
        translatable_fields = []
        for row in survey_content.get('survey', []):
            if row['type'] in ['audio', 'video', 'text']:
                translatable_fields.append(row['name'])
        params = {'values': translatable_fields}
        return params

    def load_params(self, params):
        self.translatable_fields = params['values']
        self.available_services = params.get('services', [])

    @property
    def jsonschema_properties(self):
        '''
        the schema of attributes which can be submitted to a submission
        '''
        # first attempt at this caused problems
        # going to revisit with TDD
        return {}
