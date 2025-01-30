from ..constants import QUAL_SOURCE_TYPES
from ..actions.base import BaseAction
from ..jsonschemas.qual_schema import DEFINITIONS as QUAL_DEFINITIONS


class QualAction(BaseAction):
    ID = 'qual'

    @classmethod
    def build_params(cls, survey_content):
        _fields = []
        for row in survey_content.get('survey', []):
            if row['type'] in QUAL_SOURCE_TYPES:
                _fields.append(row['name'])
        return {'values': _fields}

    def load_params(self, params):
        """
        Action.load_params is called when the instance is initialized
        for each Asset. It will
        """
        self.fields = params.get('values', [])
        self.qual_survey = params.get('qual_survey', [])
        self.everything_else = params

    @classmethod
    def get_values_for_content(cls, content):
        """
        If no "values" are defined for a given asset, then this method will
        generate a set of defaults.
        """
        values = []
        for row in content.get('survey', []):
            if row['type'] in QUAL_SOURCE_TYPES:
                values.append(cls.get_xpath(cls, row))
        return values

    def modify_jsonschema(self, schema):
        definitions = schema.setdefault('definitions', {})
        definitions.update(QUAL_DEFINITIONS)

        for qual_item in self.qual_survey:
            if qual_item.get('scope') != 'by_question#survey':
                raise NotImplementedError(
                    'by_question#survey is the only implementation'
                )
            item_xpath = qual_item.get('xpath')
            schema['properties'].setdefault(
                item_xpath,
                {
                    'type': 'object',
                    'additionalProperties': False,
                    'properties': {
                        self.ID: {
                            'type': 'array',
                            'items': {
                                '$ref': '#/definitions/qual_item',
                            },
                        }
                    },
                },
            )
        return schema

    def compile_revised_record(self, content, edits):
        """
        a method that applies changes to a json structure but stores NO
        revision history
        """
        for field_name, vals in edits.items():
            if field_name == 'submission':
                continue

            edit_list = vals.get(self.ID)
            if edit_list is None:
                continue

            edits_by_uuid = {e['uuid']: e for e in edit_list}
            existing_list = content.setdefault(field_name, {}).get(self.ID, [])
            existing_by_uuid = {e['uuid']: e for e in existing_list}
            existing_by_uuid.update(edits_by_uuid)
            content[field_name][self.ID] = list(existing_by_uuid.values())

        return content

    def is_auto_request(self, erecord):
        # could also `return False`, but this shouldn't be getting called at
        # all given the other method overrides
        raise NotImplementedError()

    def init_field(self, edit):
        # could simply `return edit`, but this shouldn't be getting called at
        # all given the other method overrides
        raise NotImplementedError()

    def revise_field(self, original, edit):
        raise NotImplementedError()

    def record_repr(self, record):
        raise NotImplementedError()

    def has_change(self, original, edit):
        raise NotImplementedError()
