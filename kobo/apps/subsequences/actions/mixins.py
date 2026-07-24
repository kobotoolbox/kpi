from copy import deepcopy

from dateutil import parser

from ..constants import SORT_BY_DATE_FIELD
from ..exceptions import TranscriptionNotFound
from ..type_aliases import SimplifiedOutputCandidatesByColumnKey


class RequiresTranscriptionMixin:

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
        latest_deletion_dt = None

        if 'value' in action_data and action_data['value'] is None:
            return action_data

        for action_id, action_supplemental_data in self._action_dependencies[
            'question_supplemental_data'
        ].items():
            # avoid circular imports
            from . import ManualQualAction

            if action_id == ManualQualAction.ID:
                continue
            versions = action_supplemental_data.get(self.VERSION_FIELD) or []
            if not versions:
                continue

            for version in versions:
                version_data = version.get(self.VERSION_DATA_FIELD, {})

                is_deleted = (
                    'status' not in version_data and version_data.get('value') is None
                ) or version_data.get('status') == 'deleted'

                if is_deleted:
                    # Track the most recent deletion timestamp across all versions
                    created_raw = version.get(self.DATE_CREATED_FIELD)
                    created_dt = parser.parse(created_raw)
                    if latest_deletion_dt is None or created_dt > latest_deletion_dt:
                        latest_deletion_dt = created_dt
                else:
                    # Skip versions that are not accepted
                    accepted_raw = version.get(self.DATE_ACCEPTED_FIELD)
                    if not accepted_raw:
                        continue

                    accepted_dt = parser.parse(accepted_raw)
                    if latest_accepted_dt is None or accepted_dt > latest_accepted_dt:
                        latest_accepted_dt = accepted_dt
                        latest_version = version
                        latest_version_action_id = action_id

        if latest_version is None or (
            latest_deletion_dt and latest_deletion_dt > latest_accepted_dt
        ):
            raise TranscriptionNotFound

        latest_version_data = latest_version.get(self.VERSION_DATA_FIELD, {})

        # Prefer a specific locale when available; otherwise use the base language.
        language_or_locale = (
            latest_version_data.get('locale') or latest_version_data['language']
        )

        # Inject dependency property for translation service
        action_data[self.DEPENDENCY_FIELD] = {
            'value': latest_version_data['value'],
            'language': language_or_locale,
            self.UUID_FIELD: latest_version[self.UUID_FIELD],
            self.ACTION_ID_FIELD: latest_version_action_id,
        }

        return action_data


class TranscriptionActionMixin:
    """
    Provides common methods and properties used by all transcription-related actions.

    This mixin centralizes them so that both manual and automatic transcription classes
    can reuse the same structure consistently.
    """

    @property
    def col_type(self):
        return 'transcript'

    def transform_data_for_output(
        self, action_data: dict
    ) -> SimplifiedOutputCandidatesByColumnKey:
        versions = action_data.get('_versions', [])
        if not versions:
            return {}

        # Sort by _dateCreated (newest first) so we always evaluate the latest
        # version, whether it is accepted or still pending review
        versions_sorted = sorted(
            versions,
            key=lambda x: x.get(self.DATE_CREATED_FIELD, ''),
            reverse=True,
        )

        latest = versions_sorted[0]
        version_data = latest.get(self.VERSION_DATA_FIELD, {})

        # Skip results with a missing or None value, as they represent deleted
        # or in-progress transcriptions. Google "no speech detected" results
        # use an empty string and are returned normally
        if version_data.get('value') is None:
            return {}

        date_accepted = latest.get(self.DATE_ACCEPTED_FIELD)
        pending_review = not bool(date_accepted)
        sort_by_date = date_accepted or latest.get(self.DATE_CREATED_FIELD)

        entry = {
            'languageCode': version_data['language'],
            'regionCode': version_data.get('locale'),
            SORT_BY_DATE_FIELD: sort_by_date,
        }

        if pending_review:
            entry['pendingReview'] = True
        else:
            entry['value'] = version_data.get('value')

        return {self.col_type: entry}

    @property
    def result_schema(self):

        # Move localized_value_schema definitions to main schema
        if self.action_class_config.automatic:
            data_schema = self.external_data_schema
        else:
            data_schema = self.data_schema
        data_schema = deepcopy(data_schema)
        data_schema_defs = data_schema.pop('$defs')
        data_schema.pop('$schema')  # Also discard this prior to nesting

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
                        self.VERSION_DATA_FIELD: {'$ref': '#/$defs/dataSchema'},
                        self.DATE_CREATED_FIELD: {'$ref': '#/$defs/dateTime'},
                        self.DATE_ACCEPTED_FIELD: {'$ref': '#/$defs/dateTime'},
                        self.UUID_FIELD: {'$ref': '#/$defs/uuid'},
                    },
                    'required': [self.DATE_CREATED_FIELD, self.UUID_FIELD],
                },
                'uuid': {'type': 'string', 'format': 'uuid'},
                'dataSchema': data_schema,
                **data_schema_defs,  # Copy defs at the root level
            },
        }

        return schema


class TranslationActionMixin(RequiresTranscriptionMixin):
    """
    Provides common methods and properties used by all translation-related actions.

    This mixin centralizes them so that both manual and automatic translation classes
    can reuse the same structure consistently.
    """

    @property
    def col_type(self):
        return 'translation'

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
        if self.action_class_config.automatic:
            data_schema = self.external_data_schema
        else:
            data_schema = self.data_schema
        data_schema = deepcopy(data_schema)
        data_schema_defs = data_schema.pop('$defs')
        data_schema.pop('$schema')  # Also discard this prior to nesting

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
                        self.VERSION_DATA_FIELD: {'$ref': '#/$defs/dataSchema'},
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
                                'properties': {
                                    self.VERSION_DATA_FIELD: {
                                        'type': 'object',
                                        'properties': {
                                            'value': {'type': 'null'},
                                        },
                                        'required': ['value'],
                                    }
                                },
                            },
                            # …then `_dependency` must be absent.
                            'then': {
                                # Quand value est null → _dependency doit être absent
                                'not': {'required': ['_dependency']}
                            },
                            # Otherwise (value is absent or not null), `_dependency` is
                            # required.
                            'else': {'required': ['_dependency']},
                        }
                    ],
                },
                'uuid': {'type': 'string', 'format': 'uuid'},
                'dataSchema': data_schema,
                **data_schema_defs,
            },
        }

        return schema

    def transform_data_for_output(
        self, action_data: dict
    ) -> SimplifiedOutputCandidatesByColumnKey:
        result = {}
        for language, language_data in action_data.items():
            versions = language_data.get('_versions', [])
            if not versions:
                continue

            versions_sorted = sorted(
                versions,
                key=lambda x: x.get(self.DATE_CREATED_FIELD, ''),
                reverse=True,
            )
            latest = versions_sorted[0]
            version_data = latest.get(self.VERSION_DATA_FIELD, {})

            # Skip deleted or in-progress versions
            if version_data.get('value') is None:
                continue

            date_accepted = latest.get(self.DATE_ACCEPTED_FIELD)
            pending_review = not bool(date_accepted)
            sort_by_date = date_accepted or latest.get(self.DATE_CREATED_FIELD)

            key = (self.col_type, language)
            entry = {
                'languageCode': version_data['language'],
                SORT_BY_DATE_FIELD: sort_by_date,
            }

            if pending_review:
                entry['pendingReview'] = True
            else:
                entry['value'] = version_data.get('value')

            result[key] = entry

        return result
