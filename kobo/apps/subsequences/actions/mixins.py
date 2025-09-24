class TranscriptionResultSchemaMixin:
    """
    Provides the `result_schema` property used by all transcription-related actions.

    This mixin centralizes the schema definition so that both manual and automated
    transcription classes can reuse the same structure consistently.
    """

    @property
    def result_schema(self):

        # Move localized_value_schema definitions to main schema
        if self.action_class_config.automated:
            data_schema_defs = self.automated_data_schema.get('$defs', {})
        else:
            data_schema_defs = self.data_schema.get('$defs', {})

        schema = {
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                self.VERSION_FIELD: {
                    'type': 'array',
                    'minItems': 1,
                    'items': {'$ref': '#/$defs/version'},
                },
                self.DATE_CREATED_FIELD: {'$ref': '#/$defs/dateTime'},
                self.DATE_MODIFIED_FIELD: {'$ref': '#/$defs/dateTime'},
            },
            'required': [self.DATE_CREATED_FIELD, self.DATE_MODIFIED_FIELD],
            '$defs': {
                'dateTime': {'type': 'string', 'format': 'date-time'},
                'version': {
                    'type': 'object',
                    'additionalProperties': False,
                    'properties': {
                        self.DATE_CREATED_FIELD: {'$ref': '#/$defs/dateTime'},
                        self.DATE_ACCEPTED_FIELD: {'$ref': '#/$defs/dateTime'},
                        self.UUID_FIELD: {'$ref': '#/$defs/uuid'},
                    },
                    'required': [self.DATE_CREATED_FIELD, self.UUID_FIELD],
                },
                'uuid': {'type': 'string', 'format': 'uuid'},
                **data_schema_defs,  # Copy defs at the root level
            },
        }

        # Also inject data schema in the version definition
        self._inject_data_schema(
            schema['$defs']['version'], ['$schema', 'title', '$defs']
        )

        return schema


class TranslationResultSchemaMixin:
    """
    Provides the `result_schema` property used by all translation-related actions.

    This mixin centralizes the schema definition so that both manual and automated
    translation classes can reuse the same structure consistently.
    """

    @property
    def result_schema(self):
        localized_value_schema = {
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                self.VERSION_FIELD: {
                    'type': 'array',
                    'minItems': 1,
                    'items': {'$ref': '#/$defs/version'},
                },
                self.DATE_CREATED_FIELD: {'$ref': '#/$defs/dateTime'},
                self.DATE_MODIFIED_FIELD: {'$ref': '#/$defs/dateTime'},
            },
            'required': [self.DATE_CREATED_FIELD, self.DATE_MODIFIED_FIELD],
        }

        # Move localized_value_schema definitions to main schema
        if self.action_class_config.automated:
            data_schema_defs = self.automated_data_schema.get('$defs', {})
        else:
            data_schema_defs = self.data_schema.get('$defs', {})

        schema = {
            '$schema': 'https://json-schema.org/draft/2020-12/schema',
            'type': 'object',
            'additionalProperties': False,
            'properties': {
                language: {'$ref': '#/$defs/dataActionKey'}
                for language in self.languages
            },
            '$defs': {
                'dataActionKey': localized_value_schema,
                'dateTime': {'type': 'string', 'format': 'date-time'},
                'version': {
                    'type': 'object',
                    'additionalProperties': False,
                    'properties': {
                        self.DATE_CREATED_FIELD: {'$ref': '#/$defs/dateTime'},
                        self.DATE_ACCEPTED_FIELD: {'$ref': '#/$defs/dateTime'},
                        self.UUID_FIELD: {'$ref': '#/$defs/uuid'},
                    },
                    'required': [self.DATE_CREATED_FIELD, self.UUID_FIELD],
                },
                'uuid': {'type': 'string', 'format': 'uuid'},
                **data_schema_defs,
            },
        }

        # Also inject data schema in the version definition
        self._inject_data_schema(
            schema['$defs']['version'], ['$schema', 'title', '$defs']
        )

        return schema
