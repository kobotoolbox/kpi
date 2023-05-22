from ..actions.base import BaseAction, ACTION_NEEDED, PASSES
from ..jsonschemas.qual_schema import DEFINITIONS as QUAL_DEFINITIONS

QUAL_BASE_DEFINITION = {
  'type': 'object',
  'properties': {
    'uuid': {'type': 'string'},
  },
  'required': ['uuid', 'type'],
}

QUAL_COMMON_DEFINITIONS = {
    'qual_item': {
        'anyOf': [{'$ref': f'#/definitions/{typ}'} for typ in [
            'qual_tags',
            'qual_text',
            'qual_integer',
            'qual_select_one',
            'qual_select_multiple',
        ]],
        'allOf': [{'$ref': '#/definitions/qual_base'}],
    },
    'qual_tags': {
        'type': 'object',
        'properties': {
            'tags': {
                'type': 'array',
                'items': {'type': 'string'},
            },
            'type': {'const': 'qual_tags'},
        },
    },
    'qual_text': {
        'type': 'object',
        'properties': {
            'type': {'const': 'qual_text'},
            'response': {
                'type': 'string',
            },
        },
        'required': ['response'],
    },
    'qual_integer': {
        'type': 'object',
        'properties': {
            'type': {'const': 'qual_integer'},
            'value': {'type': 'integer'},
        },
        'required': ['value'],
    },
    'qual_select_one': {
        'type': 'object',
        'properties': {
            'type': {'const': 'qual_select_one'},
            'value': {'type': 'string'},
        },
        'required': ['value'],
    },
    'qual_select_multiple': {
        'type': 'object',
        'properties': {
            'type': {'const': 'qual_select_multiple'},
            'values': {
                'type': 'array',
                'items': {'type': 'string'},
            },
        },
        'required': ['values'],
    },
}

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
        ## ok, figure out where `values` comes from
        self.fields = params.get('values', [])

        # NOCOMMIT
        self.everything_else = params

    @classmethod
    def get_values_for_content(kls, content):
        fields = []
        for row in content.get('survey', []):
            if row['type'] in ['audio', 'video']:
                fields.append(kls.get_qpath(kls, row))
        return fields

    def modify_jsonschema(self, schema):
        # NOCOMMIT write comment
        definitions = schema.setdefault('definitions', QUAL_DEFINITIONS)

        for main_question, qual_schema in self.everything_else[
            'by_question'
        ].items():
            field_def = schema['properties'].setdefault(
                main_question,
                {'type': 'object', 'properties': {}},
            )
            field_def['properties'][self.ID] = {
                'type': 'array',
                'items': { '$ref': '#/definitions/qual_item' },
            }
        return schema
