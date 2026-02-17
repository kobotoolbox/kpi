from drf_spectacular.plumbing import build_array_type, build_object_type

from kpi.schema_extensions.v2.generic.schema import (
    GENERIC_DATETIME_SCHEMA,
    GENERIC_STRING_SCHEMA,
    GENERIC_UUID_SCHEMA,
)
from kpi.utils.schema_extensions.mixins import ComponentRegistrationMixin


class SupplementalDataComponentsRegistrationMixin(ComponentRegistrationMixin):
    """
    Mixin to register reusable OpenAPI components for supplemental data
    (transcription, translation, qualitative analysis).
    """

    def _register_supplemental_data_components(self, auto_schema, qual_references=None):
        """
        Register shared components and return a dictionary of their references.

        :param qual_references: References from QualComponentsRegistrationMixin
                                required if using qualitative actions.
        """
        references = {}

        # 1. Dependency (for translation actions)
        references['dependency'] = self._register_schema_component(
            auto_schema,
            'SupplementalDataDependency',
            build_object_type(
                additionalProperties=False,
                properties={
                    '_actionId': GENERIC_STRING_SCHEMA,
                    '_uuid': GENERIC_UUID_SCHEMA,
                },
                required=['_actionId', '_uuid'],
            ),
        )

        # 2. Manual Data Content
        references['content_manual'] = self._register_schema_component(
            auto_schema,
            'SupplementalDataContentManual',
            build_object_type(
                additionalProperties=False,
                properties={
                    'language': GENERIC_STRING_SCHEMA,
                    'locale': GENERIC_STRING_SCHEMA,
                    'value': {'type': 'string', 'nullable': True},
                },
                required=['language', 'value'],
            ),
        )

        # 3. Automatic Data Content Sub-components
        references['content_automatic_in_progress'] = self._register_schema_component(
            auto_schema,
            'SupplementalDataContentAutomaticInProgress',
            build_object_type(
                additionalProperties=False,
                properties={
                    'language': GENERIC_STRING_SCHEMA,
                    'locale': GENERIC_STRING_SCHEMA,
                    'status': {'type': 'string', 'const': 'in_progress'},
                },
                required=['language', 'status'],
            ),
        )

        references['content_automatic_failed'] = self._register_schema_component(
            auto_schema,
            'SupplementalDataContentAutomaticFailed',
            build_object_type(
                additionalProperties=False,
                properties={
                    'language': GENERIC_STRING_SCHEMA,
                    'locale': GENERIC_STRING_SCHEMA,
                    'status': {'type': 'string', 'const': 'failed'},
                    'error': {'type': 'string'},
                },
                required=['language', 'status', 'error'],
            ),
        )

        references['content_automatic_complete'] = self._register_schema_component(
            auto_schema,
            'SupplementalDataContentAutomaticComplete',
            build_object_type(
                additionalProperties=False,
                properties={
                    'language': GENERIC_STRING_SCHEMA,
                    'locale': GENERIC_STRING_SCHEMA,
                    'status': {'type': 'string', 'const': 'complete'},
                    'value': {'type': 'string'},
                },
                required=['language', 'status', 'value'],
            ),
        )

        references['content_automatic_deleted'] = self._register_schema_component(
            auto_schema,
            'SupplementalDataContentAutomaticDeleted',
            build_object_type(
                additionalProperties=False,
                properties={
                    'language': GENERIC_STRING_SCHEMA,
                    'locale': GENERIC_STRING_SCHEMA,
                    'status': {'type': 'string', 'const': 'deleted'},
                    'value': {'type': 'null'},
                },
                required=['language', 'status', 'value'],
            ),
        )

        references['content_automatic'] = self._register_schema_component(
            auto_schema,
            'SupplementalDataContentAutomatic',
            {
                'oneOf': [
                    references['content_automatic_in_progress'],
                    references['content_automatic_failed'],
                    references['content_automatic_complete'],
                    references['content_automatic_deleted'],
                ]
            },
        )

        # 4. Version Item Manual (Generic)
        references['version_item_manual'] = self._register_schema_component(
            auto_schema,
            'SupplementalDataVersionItemManual',
            build_object_type(
                additionalProperties=False,
                properties={
                    '_dateCreated': GENERIC_DATETIME_SCHEMA,
                    '_uuid': GENERIC_UUID_SCHEMA,
                    '_dateAccepted': GENERIC_DATETIME_SCHEMA,
                    '_data': references['content_manual'],
                },
                required=['_dateCreated', '_uuid', '_dateAccepted', '_data'],
            ),
        )

        # 5. Version Item Manual With Dependency (for Translation)
        references['version_item_manual_dep'] = self._register_schema_component(
            auto_schema,
            'SupplementalDataVersionItemManualWithDep',
            build_object_type(
                additionalProperties=False,
                properties={
                    '_dateCreated': GENERIC_DATETIME_SCHEMA,
                    '_uuid': GENERIC_UUID_SCHEMA,
                    '_dateAccepted': GENERIC_DATETIME_SCHEMA,
                    '_dependency': references['dependency'],
                    '_data': references['content_manual'],
                },
                required=[
                    '_dateCreated',
                    '_uuid',
                    '_dateAccepted',
                    '_dependency',
                    '_data',
                ],
            ),
        )

        # 6. Version Item Automatic (Status-aware)
        references['version_item_automatic'] = self._register_schema_component(
            auto_schema,
            'SupplementalDataVersionItemAutomatic',
            build_object_type(
                additionalProperties=False,
                properties={
                    '_dateCreated': GENERIC_DATETIME_SCHEMA,
                    '_uuid': GENERIC_UUID_SCHEMA,
                    '_dateAccepted': GENERIC_DATETIME_SCHEMA,
                    '_data': references['content_automatic'],
                },
                required=['_dateCreated', '_uuid', '_data'],
            ),
        )

        # 7. Version Item Automatic With Dependency (for Automatic Translation)
        references['version_item_automatic_dep'] = self._register_schema_component(
            auto_schema,
            'SupplementalDataVersionItemAutomaticWithDep',
            build_object_type(
                additionalProperties=False,
                properties={
                    '_dateCreated': GENERIC_DATETIME_SCHEMA,
                    '_uuid': GENERIC_UUID_SCHEMA,
                    '_dateAccepted': GENERIC_DATETIME_SCHEMA,
                    '_dependency': references['dependency'],
                    '_data': references['content_automatic'],
                },
                required=['_dateCreated', '_uuid', '_dependency', '_data'],
            ),
        )

        # 8. Action Object Manual
        references['action_object_manual'] = self._register_schema_component(
            auto_schema,
            'SupplementalDataActionObjectManual',
            build_object_type(
                additionalProperties=False,
                properties={
                    '_dateCreated': GENERIC_DATETIME_SCHEMA,
                    '_dateModified': GENERIC_DATETIME_SCHEMA,
                    '_versions': build_array_type(
                        schema=references['version_item_manual'], min_length=1
                    ),
                },
                required=['_dateCreated', '_dateModified', '_versions'],
            ),
        )

        # 9. Action Object Manual With Dependency
        references['action_object_manual_dep'] = self._register_schema_component(
            auto_schema,
            'SupplementalDataActionObjectManualWithDep',
            build_object_type(
                additionalProperties=False,
                properties={
                    '_dateCreated': GENERIC_DATETIME_SCHEMA,
                    '_dateModified': GENERIC_DATETIME_SCHEMA,
                    '_versions': build_array_type(
                        schema=references['version_item_manual_dep'], min_length=1
                    ),
                },
                required=['_dateCreated', '_dateModified', '_versions'],
            ),
        )

        # 10. Action Object Automatic
        references['action_object_automatic'] = self._register_schema_component(
            auto_schema,
            'SupplementalDataActionObjectAutomatic',
            build_object_type(
                additionalProperties=False,
                properties={
                    '_dateCreated': GENERIC_DATETIME_SCHEMA,
                    '_dateModified': GENERIC_DATETIME_SCHEMA,
                    '_versions': build_array_type(
                        schema=references['version_item_automatic'], min_length=1
                    ),
                },
                required=['_dateCreated', '_dateModified', '_versions'],
            ),
        )

        # 11. Action Object Automatic With Dependency
        references['action_object_automatic_dep'] = (
            self._register_schema_component(
                auto_schema,
                'SupplementalDataActionObjectAutomaticWithDep',
                build_object_type(
                    additionalProperties=False,
                    properties={
                        '_dateCreated': GENERIC_DATETIME_SCHEMA,
                        '_dateModified': GENERIC_DATETIME_SCHEMA,
                        '_versions': build_array_type(
                            schema=references['version_item_automatic_dep'],
                            min_length=1,
                        ),
                    },
                    required=['_dateCreated', '_dateModified', '_versions'],
                ),
            )
        )

        # 12. Translation Maps (Map<LanguageCode, ActionObject>)
        references['translation_map_manual'] = self._register_schema_component(
            auto_schema,
            'SupplementalDataTranslationMapManual',
            build_object_type(
                additionalProperties=references['action_object_manual_dep'],
                description='Map of language codes to manual translation objects',
            ),
        )

        references['translation_map_automatic'] = self._register_schema_component(
            auto_schema,
            'SupplementalDataTranslationMapAutomatic',
            build_object_type(
                additionalProperties=references['action_object_automatic_dep'],
                description='Map of language codes to automatic translation objects',
            ),
        )

        # 13. Qual Action Object
        if qual_references:
            references['qual_data'] = self._register_schema_component(
                auto_schema,
                'SupplementalDataQualData',
                {
                    'oneOf': [
                        qual_references['qual_integer'],
                        qual_references['qual_text'],
                        qual_references['qual_select_one'],
                        qual_references['qual_select_multiple'],
                        qual_references['qual_tags'],
                    ]
                }
            )

            references['version_item_qual'] = self._register_schema_component(
                auto_schema,
                'SupplementalDataVersionItemQual',
                build_object_type(
                    additionalProperties=False,
                    properties={
                        '_data': references['qual_data'],
                        '_dateAccepted': GENERIC_DATETIME_SCHEMA,
                        '_dateCreated': GENERIC_DATETIME_SCHEMA,
                        '_uuid': GENERIC_UUID_SCHEMA,
                    },
                    required=['_data', '_dateCreated', '_uuid'],
                ),
            )

            references['action_object_qual'] = self._register_schema_component(
                auto_schema,
                'SupplementalDataActionObjectQual',
                build_object_type(
                    additionalProperties=False,
                    properties={
                        '_dateCreated': GENERIC_DATETIME_SCHEMA,
                        '_dateModified': GENERIC_DATETIME_SCHEMA,
                        '_versions': build_array_type(
                            schema=references['version_item_qual'],
                            min_length=1,
                        ),
                    },
                    required=['_dateCreated', '_dateModified', '_versions'],
                ),
            )

            references['qual_map'] = self._register_schema_component(
                auto_schema,
                'SupplementalDataQualMap',
                build_object_type(
                    additionalProperties=references['action_object_qual'],
                    patternProperties={ 
                        # UUID keys
                        '^[0-9a-fA-F-]{36}$': references['action_object_qual'],
                    },
                    description='Map of qualitative question UUIDs to their action objects',
                ),
            )

        return references
