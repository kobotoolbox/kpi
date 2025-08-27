
class TranscriptionResultSchemaMixin:

    @property
    def result_schema(self):
        schema = {
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                self.REVISIONS_FIELD: {
                    'type': 'array',
                    'minItems': 1,
                    'items': {'$ref': '#/$defs/revision'},
                },
                self.DATE_CREATED_FIELD: {'$ref': '#/$defs/dateTime'},
                self.DATE_MODIFIED_FIELD: {'$ref': '#/$defs/dateTime'},
                self.DATE_ACCEPTED_FIELD: {'$ref': '#/$defs/dateTime'},
            },
            'required': [self.DATE_CREATED_FIELD, self.DATE_MODIFIED_FIELD],
            '$defs': {
                'dateTime': {'type': 'string', 'format': 'date-time'},
                'revision': {
                    'type': 'object',
                    'additionalProperties': False,
                    'properties': {
                        self.DATE_CREATED_FIELD: {'$ref': '#/$defs/dateTime'},
                        self.DATE_ACCEPTED_FIELD: {'$ref': '#/$defs/dateTime'},
                    },
                    'required': [self.DATE_CREATED_FIELD],
                },
            },
        }

        # Inject data schema in result schema template
        self._inject_data_schema(schema, ['$schema', 'title', 'type'])

        # Also inject data schema in the revision definition
        self._inject_data_schema(
            schema['$defs']['revision'], ['$schema', 'title', '$defs']
        )

        return schema


class TranslationResultSchemaMixin:

    @property
    def result_schema(self):
        localized_value_schema = {
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                self.REVISIONS_FIELD: {
                    'type': 'array',
                    'minItems': 1,
                    'items': {'$ref': '#/$defs/revision'},
                },
                self.DATE_CREATED_FIELD: {'$ref': '#/$defs/dateTime'},
                self.DATE_MODIFIED_FIELD: {'$ref': '#/$defs/dateTime'},
                self.DATE_ACCEPTED_FIELD: {'$ref': '#/$defs/dateTime'},
            },
            'required': [self.DATE_CREATED_FIELD, self.DATE_MODIFIED_FIELD],
        }

        # Inject data schema in result schema template
        self._inject_data_schema(localized_value_schema, ['$schema', 'title', 'type'])

        # Move localized_value_schema definitions to main schema
        localized_value_schema_defs = localized_value_schema.pop('$defs')

        schema = {
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'type': 'array',
            'additionalProperties': False,
            'items': {'$ref': '#/$defs/localized_value_schema'},
            '$defs': {
                'dateTime': {'type': 'string', 'format': 'date-time'},
                'revision': {
                    'type': 'object',
                    'additionalProperties': False,
                    'properties': {
                        self.DATE_CREATED_FIELD: {'$ref': '#/$defs/dateTime'},
                        self.DATE_ACCEPTED_FIELD: {'$ref': '#/$defs/dateTime'},
                    },
                    'required': [self.DATE_CREATED_FIELD],
                },
                'localized_value_schema': localized_value_schema,
                **localized_value_schema_defs,
            },
        }

        # Also inject data schema in the revision definition
        self._inject_data_schema(
            schema['$defs']['revision'], ['$schema', 'title', '$defs']
        )

        return schema
