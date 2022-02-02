from django.utils import timezone

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
                translatable_fields.append(kls.get_name(kls, row))
        params = {'values': translatable_fields}
        return params

    @classmethod
    def get_values_for_content(kls, content):
        translatable_fields = []
        for row in content.get('survey', []):
            if row['type'] in ['audio', 'video', 'text']:
                name = kls.get_name(kls, row)
                if name:
                    translatable_fields.append(name)
        return translatable_fields

    def load_params(self, params):
        self.translatable_fields = params.get('values', [])
        self.languages = params['languages']
        self.available_services = params.get('services', [])

    def has_change(self, orecord, erecord):
        for language in self.languages:
            olang = orecord.get(language, False)
            elang = erecord.get(language, False)
            if olang is False or elang is False:
                return True
            if self.record_repr(olang) != self.record_repr(elang):
                return True
        return False

    def revise_field(self, original, edit):
        record = {}
        for language in self.languages:
            if language not in edit:
                if language in original:
                    record[language] = original[language]
                continue
            if language in original:
                old = original[language]
            else:
                old = self.init_translation_record(language, {})
            upd = edit[language]
            if upd.get('value') == self.DELETE:
                continue
            revisions = old.pop('revisions', [])
            if self.DATE_CREATED_FIELD in old:
                del old[self.DATE_CREATED_FIELD]
            upd[self.DATE_MODIFIED_FIELD] = \
                upd[self.DATE_CREATED_FIELD] = \
                str(timezone.now()).split('.')[0]
            revisions = [old, *revisions]
            if len(revisions) > 0:
                upd[self.DATE_CREATED_FIELD] = \
                    revisions[-1][self.DATE_MODIFIED_FIELD]
            upd['revisions'] = revisions
            record[language] = upd
        return record


    def init_translation_record(self, langcode, value):
        curtime = self.cur_time()
        data = {**value, 'revisions': []}
        data[self.DATE_CREATED_FIELD] = data[self.DATE_MODIFIED_FIELD] = curtime
        return data

    def init_field(self, edit):
        for langcode in self.languages:
            if langcode in edit:
                edit[langcode] = \
                    self.init_translation_record(langcode, edit[langcode])
        return edit

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

    def addl_fields(self):
        service = 'manual'
        for field in self.translatable_fields:
            for language in self.languages:
                label = f'{field} Translated ({language})'
                yield {
                    'type': 'text',
                    'name': f'{field}/{service}',
                    'label': label,
                    'path': [field, service],
                    'source': field,
                    'settings': {
                        'mode': 'auto',
                        'engine': f'engines/translated',
                    }
                }

    def engines(self):
        manual_name = f'engines/translated'
        manual_engine = {
            'details': 'A human provided translation'
        }
        yield (manual_name, manual_engine)
