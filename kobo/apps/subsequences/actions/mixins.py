from dateutil import parser

from ..exceptions import TranscriptionNotFound


class TranscriptionActionMixin:
    """
    Provides common methods and properties used by all transcription-related actions.

    This mixin centralizes them so that both manual and automated transcription classes
    can reuse the same structure consistently.
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


class TranslationActionMixin:
    """
    Provides common methods and properties used by all translation-related actions.

    This mixin centralizes them so that both manual and automated translation classes
    can reuse the same structure consistently.
    """

    def attach_action_dependency(self, action_data: dict):
        """
        Attach the latest *accepted* transcript as a dependency for a translation
        action.

        Selection logic:
          - Scan `self._action_dependencies` for prior transcription actions.
          - Consider only versions that have a non-empty `DATE_ACCEPTED_FIELD`.
          - Pick the version with the most recent acceptance timestamp.
          - Prefer a specific `locale` if present; otherwise fall back to `language`.

        Side effects:
          - Mutates and returns `action_data` by setting `action_data[DEPENDENCY_FIELD]`
            to a sanitized dependency payload.

        Deletion guard:
          - If the caller explicitly wants to delete the translation, i.e.:
            `action_data['value']` equals `None`, this is treated no dependency is
            attached.

        Injected payload (sanitized):
          - 'value'      : transcript text
          - 'language'   : locale if present, else base language
          - '_uuid'      : transcript UUID
          - '_action_id' : source transcription action ID

        Raises:
          - TranscriptionNotFound: if no accepted transcript is available.
        """

        latest_version = latest_accepted_dt = latest_version_action_id = None

        # If deletion has been requested, we do not want to attach any dependency.
        if 'value' in action_data and action_data['value'] is None:
            return action_data

        for action_id, action_supplemental_data in self._action_dependencies.items():

            versions = action_supplemental_data.get(self.VERSION_FIELD) or []
            for version in versions:
                # Skip versions without an acceptance timestamp.
                accepted_raw = version.get(self.DATE_ACCEPTED_FIELD)
                if not accepted_raw:
                    continue

                accepted_dt = parser.parse(accepted_raw)

                if latest_accepted_dt is None or accepted_dt > latest_accepted_dt:
                    latest_accepted_dt = accepted_dt
                    latest_version = version
                    latest_version_action_id = action_id

        if latest_version is None:
            raise TranscriptionNotFound

        # Prefer a specific locale when available; otherwise use the base language.
        language_or_locale = (
            latest_version.get('locale') or latest_version['language']
        )

        # Inject dependency property for translation service
        action_data[self.DEPENDENCY_FIELD] = {
            'value': latest_version['value'],
            'language': language_or_locale,
            self.UUID_FIELD: latest_version[self.UUID_FIELD],
            self.ACTION_ID_FIELD: latest_version_action_id
        }

        return action_data

    def get_action_dependencies(self, question_supplemental_data: dict) -> dict:
        """
        Return only the supplemental data required by this action.

        This method inspects the full `question_supplemental_data` payload
        and extracts a subset containing only the actions on which the
        current action relies (e.g., transcription results needed before a
        translation).  It never mutates the original dictionary and does not
        include unrelated entries—only the minimal keys and values needed
        for this action to run correctly.
        """

        from ..actions.automated_google_transcription import (
            AutomatedGoogleTranscriptionAction
        )
        from ..actions.manual_transcription import ManualTranscriptionAction

        transcription_action_ids = (
            AutomatedGoogleTranscriptionAction.ID,
            ManualTranscriptionAction.ID,
        )

        for action_id in transcription_action_ids:

            action_supplemental_data = question_supplemental_data.get(action_id)
            if not action_supplemental_data:
                continue
            self._action_dependencies[action_id] = action_supplemental_data

        return self._action_dependencies

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
                        self.DEPENDENCY_FIELD: {
                            'type': 'object',
                            'additionalProperties': False,
                            'properties': {
                                self.UUID_FIELD: {'$ref': '#/$defs/uuid'},
                                self.ACTION_ID_FIELD: {'type': 'string'},
                            },
                            'required': [self.UUID_FIELD, self.ACTION_ID_FIELD],
                        },
                    },
                    'required': [
                        self.DATE_CREATED_FIELD,
                        self.UUID_FIELD,
                    ],
                    'allOf': [
                        # Add conditional rule: `_dependency` is required unless `value`
                        # is explicitly null.
                        {
                        'if': {
                            # If `value` exists and is null…
                            'properties': {'value': {'type': 'null'}},
                            'required': ['value']
                        },
                        # …then `_dependency` must be absent.
                        'then': {
                            # Quand value est null → _dependency doit être absent
                            'not': {'required': ['_dependency']}
                        },
                        # Otherwise (value is absent or not null), `_dependency` is
                        # required.
                        'else': {
                            'required': ['_dependency']
                        }
                    }]
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
