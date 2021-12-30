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

    @classmethod
    def get_values_for_content(kls, content):
        translatable_fields = []
        for row in content.get('survey', []):
            if row['type'] in ['audio', 'video', 'text']:
                translatable_fields.append(row['name'])
        return translatable_fields

    def load_params(self, params):
        self.translatable_fields = params.get('values', [])
        self.languages = params['languages']
        self.available_services = params.get('services', [])

    def modify_jsonschema(self, schema):
        defs = schema.get('definitions', {})
        translation_properties = {
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
        }
        defs['xtranslation'] = {
            'type': 'object',
            'additionalProperties': False,
            'properties': translation_properties,
        }
        indiv_tx_ref = {'$ref': '#/definitions/xtranslation'}
        lang_code_props = {}
        for language_code in self.languages:
            lang_code_props[language_code] = indiv_tx_ref
        defs['translation'] = {
            'type': 'object',
            'properties': lang_code_props,
            'additionalProperties': False,
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
