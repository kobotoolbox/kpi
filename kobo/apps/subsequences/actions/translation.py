from kobo.apps.subsequences.constants import GOOGLETX
from ..constants import TRANSLATABLE_SOURCE_TYPES
from ..actions.base import BaseAction

TRANSLATED = 'translation'


class TranslationAction(BaseAction):
    ID = TRANSLATED
    MANUAL = 'user_translated'

    @classmethod
    def build_params(cls, survey_content):
        translatable_fields = []
        for row in survey_content.get('survey', []):
            if row['type'] in TRANSLATABLE_SOURCE_TYPES:
                translatable_fields.append(cls.get_xpath(cls, row))
        params = {'values': translatable_fields}
        return params

    @classmethod
    def get_values_for_content(cls, content):
        translatable_fields = []
        for row in content.get('survey', []):
            if row['type'] in TRANSLATABLE_SOURCE_TYPES:
                name = cls.get_xpath(cls, row)
                if name:
                    translatable_fields.append(name)
        return translatable_fields

    def load_params(self, params):
        self.translatable_fields = params.get('values', [])
        self.languages = params['languages']
        self.available_services = params.get('services', [])

    def has_change(self, orecord, erecord):
        for language in self.languages:
            olang = orecord.get(language, {})
            elang = erecord.get(language, {})
            if not elang:
                # This language is neither being edited nor deleted (deletion
                # would send an "edit" with value ⌫ , aka `BaseAction.DELETE`)
                continue
            if not olang:
                # A new language is always a change
                return True
            if olang.get('value') != elang.get('value'):
                # An existing language has translation text that has changed
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
                upd[self.DATE_CREATED_FIELD] = self.cur_time()
            revisions = [old, *revisions]
            if len(revisions) > 0:
                date_modified = revisions[-1].get(self.DATE_MODIFIED_FIELD)
                upd[self.DATE_CREATED_FIELD] = date_modified
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
        # since 95% of this schema does not change, I will
        # move it outside of this method
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
        defs['_googletx'] = {
            'type': 'object',
            'properties': {
                'status': {
                    'enum': ['requested', 'in_progress', 'complete', 'error'],
                },
                'responseJSON': {
                    'type': 'object',
                    'properties': {
                        'error': {'type': 'string'},
                        'detail': {'type': 'string'},
                    }
                },
            }
        }
        defs['xtranslation'] = {
            'type': 'object',
            'additionalProperties': False,
            'required': ['value', 'languageCode'],
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
            field_def['properties'][GOOGLETX] = {
                '$ref': '#/definitions/_googletx',
            }
            schema['properties'][field] = field_def
        schema['definitions'] = defs
        return schema

    def addl_fields(self):
        service = 'manual'
        for field in self.translatable_fields:
            for language in self.languages:
                label = f'{field} - translation ({language})'
                _type = 'translation'
                _name = f'translated_{language}'
                yield {
                    'type': _type,
                    'name': f'{field}/{_name}',
                    'label': label,
                    'language': language,
                    'path': [field, _name],
                    'source': field,
                    'settings': {
                        'mode': 'auto',
                        'engine': f'engines/translation',
                    }
                }

    def engines(self):
        manual_name = f'engines/translation'
        manual_engine = {
            'details': 'A human provided translation'
        }
        yield (manual_name, manual_engine)

    def record_repr(self, record):
        # TODO: Make sure this method is sensible. Some places, e.g.
        # `BaseAction.is_auto_request()`, expect this method to return a
        # single string; however, multiple translations cannot be represented
        # adequately this way.
        # Cope with this by returning a single string if there is only one
        # translation, matching the previous behavior. If there is more than
        # one translation, return a dictionary of
        # `{'lang1': 'translation1','lang2': 'translation2', …}`.

        if len(record.keys()) == 1:
            return [*record.values()][0].get('value')
        return {
            lang: lang_record.get('value')
            for lang, lang_record in record.items()
        }

    def auto_request_repr(self, erecord):
        lang_code = [*erecord.values()][0]['languageCode']
        return {
            GOOGLETX: {
                'status': 'requested',
                'languageCode': lang_code,
            }
        }
