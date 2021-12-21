from ..actions.base import BaseAction, ACTION_NEEDED, PASSES

TRANSLATED = 'translated'

class TranslationAction(BaseAction):
    ID = TRANSLATED
    MANUAL = 'user_translated'

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

    def modify_jsonschema(self, schema):
        defs = schema.get('definitions', {})
        defs['translation'] = {
            'type': 'object',
            'properties': {
                'value': {'type': 'string'},
                'engine': {'type': 'string'},
                self.DATE_CREATED_FIELD: {'type': 'string',
                                          'format': 'date-time'},
                self.DATE_MODIFIED_FIELD: {'type': 'string',
                                           'format': 'date-time'},
                'languageCode': {'type': 'string'},
                'revisions': {'type': 'array', 'items': {
                    '$ref': '#/definitions/translationRevision'
                }}
            },
            'additionalProperties': False,
            'required': ['value'],
        }
        defs['translationRevision'] = {
            'type': 'object',
            'properties': {
                'value': {'type': 'string'},
                'engine': {'type': 'string'},
                self.DATE_MODIFIED_FIELD: {'type': 'string',
                                           'format': 'date-time'},
                'languageCode': {'type': 'string'},
            },
            'additionalProperties': False,
            'required': ['value'],
        }
        for field in self.translatable_fields:
            field_def = schema['properties'].get(field, {
                'type': 'object',
                'properties': {},
                'additionalProperties': False,
            })
            field_def['properties'][self.ID] = {
                '$ref': '#/definitions/translation'
            }
            schema['properties'][field] = field_def
        schema['definitions'] = defs
        return schema
