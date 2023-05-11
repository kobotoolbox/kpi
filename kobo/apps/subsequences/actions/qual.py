from ..actions.base import BaseAction, ACTION_NEEDED, PASSES


class QualAction(BaseAction):
    ID = 'qual'
    QUESTION_TO_JSON_TYPE = {
            "qual_tags": "array",
            "qual_text": "string",
            "qual_integer": "number",
            "qual_select_one": "string",
            "qual_select_multiple": "array",
            "qual_note": "null",
            "qual_auto_keyword_count": "number",
    }

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
        for main_question, qual_schema in self.everything_else[
            'by_question'
        ].items():
            qual_survey = qual_schema['survey']
            qual_submission_props = {}
            for qual_question in qual_survey:
                qual_submission_props[qual_question['uuid']] = {
                    'type': self.QUESTION_TO_JSON_TYPE[qual_question['type']]
                }

            field_def = schema['properties'].setdefault(
                main_question,
                {
                    'type': 'object',
                    'properties': {},
                },
            )
            field_def['properties'][self.ID] = {
                'type': 'object',
                'additionalProperties': False,
                'properties': qual_submission_props,
            }
        return schema
