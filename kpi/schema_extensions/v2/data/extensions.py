from django.conf import settings
from drf_spectacular.extensions import (
    OpenApiSerializerExtension,
    OpenApiSerializerFieldExtension,
)
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.schema_extensions.v2.generic.schema import (
    GENERIC_DATETIME_SCHEMA,
    GENERIC_INT_SCHEMA,
    GENERIC_STRING_SCHEMA,
    GENERIC_UUID_SCHEMA,
)
from kpi.utils.schema_extensions.mixins import (
    ComponentRegistrationMixin,
    QualComponentsRegistrationMixin,
)
from kpi.utils.schema_extensions.url_builder import build_url_type


class DataAttachmentFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.DataAttachmentsField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_object_type(
                properties={
                    'download_url': build_url_type(
                        viewname='api_v2:attachment-detail',
                        uid_asset='aTPPUDScaFZkvBzd8FyK4Q',
                        uid_data='18',
                        pk='1',
                    ),
                    'download_large_url': build_url_type(
                        viewname='api_v2:attachment-thumb',
                        uid_asset='aTPPUDScaFZkvBzd8FyK4Q',
                        uid_data='18',
                        pk='attWNZNwhXK6HDYVkZJSn9jy',
                        suffix='large',
                    ),
                    'download_medium_url': build_url_type(
                        viewname='api_v2:attachment-thumb',
                        uid_asset='aTPPUDScaFZkvBzd8FyK4Q',
                        uid_data='18',
                        pk='attWNZNwhXK6HDYVkZJSn9jy',
                        suffix='medium',
                    ),
                    'download_small_url': build_url_type(
                        viewname='api_v2:attachment-thumb',
                        uid_asset='aTPPUDScaFZkvBzd8FyK4Q',
                        uid_data='18',
                        pk='attWNZNwhXK6HDYVkZJSn9jy',
                        suffix='small',
                    ),
                    'mimetype': {'type': 'string', 'example': 'image/png'},
                    'media_file_basename': build_basic_type(OpenApiTypes.STR),
                    'filename': build_basic_type(OpenApiTypes.STR),
                    'uid': build_basic_type(OpenApiTypes.STR),
                    'question_xpath': build_basic_type(OpenApiTypes.STR),
                    'is_deleted': build_basic_type(OpenApiTypes.BOOL),
                },
                required=[
                    'download_url',
                    'mimetype',
                    'filename',
                    'uid',
                    'media_file_basename',
                    'question_xpath',
                ],
                additional_properties=False,
            )
        )


class DataBulkDeleteFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.DataBulkDeleteField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(schema=build_basic_type(OpenApiTypes.INT))


class DataBulkUpdatePayloadFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.DataBulkUpdatePayloadField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'submission_ids': build_array_type(
                    schema=build_basic_type(OpenApiTypes.INT)
                ),
                'data': build_object_type(
                    properties={
                        'field_to_update': GENERIC_STRING_SCHEMA,
                    }
                ),
            }
        )


class DataBulkUpdateResultFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.DataBulkUpdateResultField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_object_type(
                properties={
                    'uuid': GENERIC_STRING_SCHEMA,
                    'status_code': build_basic_type(OpenApiTypes.INT),
                    'message': GENERIC_STRING_SCHEMA,
                }
            )
        )


class DataSupplementPayloadExtension(
    QualComponentsRegistrationMixin, OpenApiSerializerExtension
):
    target_class = 'kpi.schema_extensions.v2.data.serializers.DataSupplementPayload'

    def question_schema(self, references):
        return build_object_type(
            additionalProperties=False,
            properties={
                'manual_transcription': self._nlp_manual_action_schema,
                'manual_translation': self._nlp_manual_action_schema,
                'automatic_google_transcription': self._nlp_automatic_action_schema,
                'automatic_google_translation': self._nlp_automatic_action_schema,
                'manual_qual': self._qual_schema(references),
                'automatic_bedrock_qual': references['automatic_qual_payload'],
            },
            anyOf=[
                {'required': ['manual_transcription']},
                {'required': ['manual_translation']},
                {'required': ['automatic_google_transcription']},
                {'required': ['automatic_google_translation']},
                {'required': ['manual_qual']},
                {'required': ['automatic_bedrock_qual']}
            ],
        )

    def map_serializer(self, auto_schema, direction):

        references = self._register_qual_schema_components(auto_schema)

        return build_object_type(
            properties={
                '_version': {
                    'type': 'string',
                    'example': '20250820',
                }
            },
            # Use a named schema component for `additionalProperties` because the
            # payload mixes:
            #   - a static key (`_version`)
            #   - dynamic keys (question names)
            #
            # When represented as a plain `additionalProperties` object, Orval generates
            # a TypeScript index signature that conflicts with the static `_version`
            # field (i.e. `[key: string]: QuestionEntry` vs `_version: string`).
            #
            # Registering and referencing a dedicated schema component here allows Orval
            # to generate a union type for dynamic values while keeping `_version`
            # correctly typed, without changing the backend response format.
            additionalProperties=self._register_schema_component(
                auto_schema,
                'PatchedDataSupplementPayloadOneOf',
                self.question_schema(references),
            ),
            patternProperties={
                '^(?!_version$).*': self._register_schema_component(
                    auto_schema,
                    'PatchedDataSupplementPayloadOneOf',
                    self.question_schema(references),
                ),
            },
            required=['_version'],
        )

    def _qual_schema(self, references):
        return {
            'oneOf': [
                references['manual_qual_integer'],
                references['manual_qual_text'],
                references['manual_qual_select_one'],
                references['manual_qual_select_multiple'],
                references['manual_qual_tags'],
            ],
        }

    @property
    def _nlp_automatic_action_schema(self):

        return build_object_type(
            additionalProperties=False,
            properties={
                'language': GENERIC_STRING_SCHEMA,
                'locale': GENERIC_STRING_SCHEMA,
                'accepted': {'type': 'boolean'},
            },
            required=['language'],
        )

    @property
    def _nlp_manual_action_schema(self):

        return build_object_type(
            additionalProperties=False,
            properties={
                'language': GENERIC_STRING_SCHEMA,
                'locale': GENERIC_STRING_SCHEMA,
                'value': {'type': 'string', 'nullable': True},
            },
            required=['language', 'value'],
        )


class DataSupplementResponseExtension(
    QualComponentsRegistrationMixin, OpenApiSerializerExtension
):
    target_class = 'kpi.schema_extensions.v2.data.serializers.DataSupplementResponse'

    def question_schema(self, references):

        return build_object_type(
            additionalProperties=False,
            properties={
                'manual_transcription': self._manual_transcription_schema,
                'manual_translation': self._manual_translation_schema,
                'automatic_google_transcription': self._automatic_transcription_schema,
                'automatic_google_translation': self._automatic_translation_schema,
                'manual_qual': self._qual_schema(references),
                'automatic_bedrock_qual': self._qual_schema(references),
            },
            # At least action must be present
            anyOf=[
                {'required': ['manual_transcription']},
                {'required': ['manual_translation']},
                {'required': ['automatic_google_transcription']},
                {'required': ['automatic_google_translation']},
                {'required': ['manual_qual']},
                {'required': ['automatic_bedrock_qual']},
            ],
        )

    def map_serializer(self, auto_schema, direction):
        references = self._register_qual_schema_components(auto_schema)
        return build_object_type(
            properties={
                '_version': {
                    'type': 'string',
                    'example': '20250820',
                }
            },
            # Use a named schema component for `additionalProperties` because the
            # payload mixes:
            #   - a static key (`_version`)
            #   - dynamic keys (question names)
            #
            # When represented as a plain `additionalProperties` object, Orval generates
            # a TypeScript index signature that conflicts with the static `_version`
            # field (i.e. `[key: string]: QuestionEntry` vs `_version: string`).
            #
            # Registering and referencing a dedicated schema component here allows Orval
            # to generate a union type for dynamic values while keeping `_version`
            # correctly typed, without changing the backend response format.
            additionalProperties=self._register_schema_component(
                auto_schema,
                'DataSupplementResponseOneOf',
                self.question_schema(references),
            ),
            patternProperties={
                '^(?!_version$).*': self._register_schema_component(
                    auto_schema,
                    'DataSupplementResponseOneOf',
                    self.question_schema(references),
                ),
            },
            required=['_version'],
        )

    @property
    def _automatic_transcription_schema(self):
        return self._build_transcription_schema(include_status=True)

    @property
    def _automatic_translation_schema(self):
        return self._build_translation_schema(include_status=True)

    def _build_transcription_schema(self, include_status=False):
        """
        Transcription Schema:
        _versions list where each item has a nested `_data` object.
        _dateAccepted is required if Manual (include_status=False), optional otherwise.
        """
        required_fields = ['_dateCreated', '_uuid', '_data']

        # If Manual (no status), dateAccepted is Mandatory.
        if not include_status:
            required_fields.append('_dateAccepted')

        version_item = build_object_type(
            additionalProperties=False,
            properties={
                '_dateCreated': GENERIC_DATETIME_SCHEMA,
                '_uuid': GENERIC_UUID_SCHEMA,
                '_dateAccepted': GENERIC_DATETIME_SCHEMA,
                '_data': self._get_data_content_schema(include_status=include_status),
            },
            required=required_fields,
        )

        return build_object_type(
            additionalProperties=False,
            properties={
                '_dateCreated': GENERIC_DATETIME_SCHEMA,
                '_dateModified': GENERIC_DATETIME_SCHEMA,
                '_versions': build_array_type(schema=version_item, min_length=1),
            },
            required=['_dateCreated', '_dateModified', '_versions'],
        )

    def _build_translation_schema(self, include_status=False):
        """
        Translation Schema:
        Map<LanguageCode, ActionObject>.
        _dateAccepted is required if Manual (include_status=False), optional otherwise.
        """

        required_fields = ['_dateCreated', '_uuid', '_dependency', '_data']

        # If Manual (no status), dateAccepted is Mandatory.
        if not include_status:
            required_fields.append('_dateAccepted')

        version_item = build_object_type(
            additionalProperties=False,
            properties={
                '_dateCreated': GENERIC_DATETIME_SCHEMA,
                '_uuid': GENERIC_UUID_SCHEMA,
                '_dependency': self._get_dependency_schema(),
                '_dateAccepted': GENERIC_DATETIME_SCHEMA,
                '_data': self._get_data_content_schema(include_status=include_status),
            },
            required=required_fields,
        )

        inner_action_schema = build_object_type(
            additionalProperties=False,
            properties={
                '_dateCreated': GENERIC_DATETIME_SCHEMA,
                '_dateModified': GENERIC_DATETIME_SCHEMA,
                '_versions': build_array_type(schema=version_item, min_length=1),
            },
            required=['_dateCreated', '_dateModified', '_versions'],
        )

        return build_object_type(additionalProperties=inner_action_schema)

    def _get_data_content_schema(self, include_status=False):
        """
        Common Schema for the nested `_data` object found in versions.
        """

        if not include_status:
            return build_object_type(
                additionalProperties=False,
                properties={
                    'language': GENERIC_STRING_SCHEMA,
                    'locale': GENERIC_STRING_SCHEMA,
                    'value': {'type': 'string', 'nullable': True},
                },
                required=['language', 'value'],
            )

        return {
            'oneOf': [
                # in_progress → no value, no error
                build_object_type(
                    additionalProperties=False,
                    properties={
                        'language': GENERIC_STRING_SCHEMA,
                        'locale': GENERIC_STRING_SCHEMA,
                        'status': {'type': 'string', 'const': 'in_progress'},
                    },
                    required=['language', 'status'],
                ),
                # failed → error required, no value
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
                # complete → value required (string)
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
                # deleted → value required AND must be null
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
            ]
        }

    def _get_dependency_schema(self):

        return build_object_type(
            additionalProperties=False,
            properties={
                '_actionId': GENERIC_STRING_SCHEMA,
                '_uuid': GENERIC_UUID_SCHEMA,
            },
            required=['_actionId', '_uuid'],
        )

    def _qual_schema(self, references, automatic=False):
        """
        Build the OpenAPI schema for the `qual` field.
        """

        # ---------------------------------------------------------------------
        # dataSchema
        #   oneOf:
        #     - qualInteger
        #     - qualSelectMultiple
        #     - qualSelectOne
        #     - qualTags
        #     - qualText
        #
        # ---------------------------------------------------------------------
        prefix = 'automatic' if automatic else 'manual'
        data_schema = {
            'oneOf': [
                references[f'{prefix}_qual_integer'],
                references[f'{prefix}_qual_text'],
                references[f'{prefix}_qual_select_one'],
                references[f'{prefix}_qual_select_multiple'],
            ]
        }
        if not automatic:
            data_schema['oneOf'].append(
                references['manual_qual_tags']
            )

        # ---------------------------------------------------------------------
        # dataActionKey._versions[] item
        #
        # $defs.dataActionKey._versions.items:
        #   - additionalProperties: false
        #   - properties:
        #       _data: dataSchema
        #       _dateAccepted: dateTime
        #       _dateCreated: dateTime
        #       _uuid: uuid
        #   - required: [_data, _dateCreated, _uuid]
        # ---------------------------------------------------------------------
        data_action_version = build_object_type(
            additionalProperties=False,
            properties={
                '_data': data_schema,
                '_dateAccepted': GENERIC_DATETIME_SCHEMA,
                '_dateCreated': GENERIC_DATETIME_SCHEMA,
                '_uuid': GENERIC_UUID_SCHEMA,
            },
            required=['_data', '_dateCreated', '_uuid'],
        )

        # ---------------------------------------------------------------------
        # dataActionKey
        #
        # $defs.dataActionKey:
        #   - additionalProperties: false
        #   - properties:
        #       _dateCreated: dateTime
        #       _dateModified: dateTime
        #       _versions: [data_action_version, ...] (minItems=1)
        #   - required: [_dateCreated, _dateModified]
        # ---------------------------------------------------------------------
        data_action_key = build_object_type(
            additionalProperties=False,
            properties={
                '_dateCreated': GENERIC_DATETIME_SCHEMA,
                '_dateModified': GENERIC_DATETIME_SCHEMA,
                '_versions': build_array_type(
                    schema=data_action_version,
                    min_length=1,
                ),
            },
            required=['_dateCreated', '_dateModified', '_versions'],
        )

        # ---------------------------------------------------------------------
        # Root "qual" object
        #
        # In the original JSON Schema, the top-level "properties" were:
        #   {
        #       "<uuid>": { $ref: '#/$defs/dataActionKey' },
        #       ...
        #   }
        # and you clarified that ALL those keys are UUIDs and that there can
        # be from 1 to N of them.
        #
        # In OpenAPI, we model that as:
        #   - an object
        #   - whose keys are dynamic
        #   - whose values follow the dataActionKey schema
        #
        # So we use `additionalProperties` to represent
        # "map<string-uuid, dataActionKey>".
        #
        # Optionally, `x-patternProperties` gives a hint that keys are UUIDs.
        # ---------------------------------------------------------------------
        qual_root = build_object_type(
            additionalProperties=data_action_key,
            # No fixed properties since keys are dynamic UUIDs
            patternProperties={
                # simple UUID-like regex; you can tighten it if desired
                '^[0-9a-fA-F-]{36}$': data_action_key,
            },
        )

        return qual_root

    @property
    def _manual_transcription_schema(self):
        return self._build_transcription_schema(include_status=False)

    @property
    def _manual_translation_schema(self):
        return self._build_translation_schema(include_status=False)


class DataValidationPayloadFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.DataValidationPayloadField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'submission_ids': build_array_type(
                    schema=build_basic_type(OpenApiTypes.INT)
                ),
                'validation_status.uid': {
                    '$ref': '#/components/schemas/DataValidationStatusUidEnum'
                },
            }
        )


class DataValidationStatusFieldExtension(
    ComponentRegistrationMixin, OpenApiSerializerFieldExtension
):
    target_class = 'kpi.schema_extensions.v2.data.fields.DataValidationStatusField'

    def map_serializer_field(self, auto_schema, direction):
        uid_enum = self._register_schema_component(
            auto_schema,
            'DataValidationStatusUidEnum',
            {'enum': list(settings.DEFAULT_VALIDATION_STATUSES.keys())},
        )
        labels_enum = self._register_schema_component(
            auto_schema,
            'DataValidationStatusLabelEnum',
            {'enum': list(settings.DEFAULT_VALIDATION_STATUSES.values())},
        )
        validation_status_schema = self._register_schema_component(
            auto_schema,
            'DataValidationStatus',
            {
                'type': 'object',
                'properties': {
                    'timestamp': GENERIC_INT_SCHEMA,
                    'uid': uid_enum,
                    'by_whom': GENERIC_STRING_SCHEMA,
                    'label': labels_enum,
                },
                'required': ['timestamp', 'uid', 'label', 'by_whom'],
                'additionalProperties': False,
            },
        )
        return {
            'oneOf': [
                validation_status_schema,
                build_object_type(maxProperties=0),
            ]
        }


class EnketoEditUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.EnketoEditUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'enketo_edit_link',
            path='/edit/iXUdUc3w?instance_id=1824b282-f729-4944-b799-7a805d4564e1&return_url=false',  # noqa
        )


class EnketoViewUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.EnketoViewUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'enketo_view_link',
            path='/view/f93d2a488a2e35cedc336e84e1bd1edc?instance_id=1824b282-f729-4944-b799-7a805d4564e1&return_url=false',  # noqa
        )


class GeoLocationFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.GeoLocationField'

    def map_serializer_field(self, autho_schema, direction):
        return {
            'type': 'array',
            'items': {'type': ['number', 'null']},
            'minItems': 2,
            'maxItems': 2,
        }
