import math

from .base import BaseAction, ACTION_NEEDED, PASSES


def double_number(number):
    # double the number,
    # preserve the type
    cast_result_to = float
    if isinstance(number, str):
        cast_result_to = str
        number = float(number)
    elif isinstance(number, int):
        cast_result_to = int
    result = number * 2
    return cast_result_to(result)


class NumberDoubler(BaseAction):
    ID = 'number_doubler'

    def load_params(self, params):
        self.values = params.get('values', [])

    def has_change(self, original, edit):
        return True

    def revise_field(self, previous, edit):
        return {'value': double_number(edit['value'])}

    def check_submission_status(self, submission):
        if self._destination_field not in submission:
            return ACTION_NEEDED
        values = submission[self._destination_field]
        for key, dest_key in self.values.items():
            if dest_key in values:
                return PASSES
        return ACTION_NEEDED

    @classmethod
    def build_params(cls, content, **kwargs):
        numeric_questions = {}
        for row in content['survey']:
            if row.get('type') in ['integer', 'decimal']:
                name = cls.get_name(row)
                numeric_questions[name] = f'{name}_doubled'
        params = {'values': numeric_questions}
        return params

    @classmethod
    def get_values_for_content(cls, content):
        """
        If no "values" are defined for a given asset, then this method will
        generate a set of defaults.
        """
        values = []
        for row in content.get('survey', []):
            if row['type'] in ['integer', 'decimal']:
                values.append(cls.get_qpath(cls, row))
        return values

    def modify_jsonschema(self, schema):
        defs = schema.setdefault('definitions', {})
        props = schema.setdefault('properties', {})
        defs[f'{self.ID}schemadef'] = {
            'type': 'object',
        }

        for field_name in self.values:
            props[field_name] = {'$ref': f'#/definitions/{self.ID}schemadef'}

        return schema
