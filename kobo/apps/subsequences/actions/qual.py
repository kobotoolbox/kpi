from ..actions.base import BaseAction, ACTION_NEEDED, PASSES


class QualAction(BaseAction):
    ID = 'qual'

    @classmethod
    def build_params(kls, survey_content):
        _fields = []
        for row in survey_content.get('survey', []):
            if row['type'] in ['audio', 'video']:
                _fields.append(row['name'])
        return {'values': _fields}
    
    def load_params(self, params):
        self.fields = params.get('values', [])

    @classmethod
    def get_values_for_content(kls, content):
        fields = []
        for row in content.get('survey', []):
            if row['type'] in ['audio', 'video']:
                fields.append(kls.get_qpath(kls, row))
        return fields

    def modify_jsonschema(self, schema):
        defs = schema.get('definitions', {})
        defs['qual'] = {'type': 'object'}
        for field in self.fields:
            field_def = schema['properties'].get(field, {
                'type': 'object',
                'properties': {},
            })
            field_def['properties'][self.ID] = {'$ref': '#/definitions/qual'}
            schema['properties'][field] = field_def
        schema['definitions'] = defs
        return schema
