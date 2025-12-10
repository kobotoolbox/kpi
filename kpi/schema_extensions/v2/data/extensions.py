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

from kpi.schema_extensions.v2.generic.schema import GENERIC_STRING_SCHEMA
from kpi.utils.schema_extensions.url_builder import build_url_type


class DataAttachmentFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.DataAttachmentField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
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
                'mimetype': build_basic_type(OpenApiTypes.STR),
                'filename': build_basic_type(OpenApiTypes.STR),
                'uid': build_basic_type(OpenApiTypes.STR),
                'question_xpath': build_basic_type(OpenApiTypes.STR),
            }
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


class DataSupplementPayloadExtension(OpenApiSerializerExtension):
    target_class = 'kpi.schema_extensions.v2.data.serializers.DataSupplementPayload'

    DATETIME = build_basic_type(OpenApiTypes.DATETIME)
    UUID_STR = {'type': 'string', 'format': 'uuid'}

    def map_serializer(self, auto_schema, direction):
        return build_object_type(
            properties={
                '_version': {
                    'type': 'string',
                    'example': '20250812',
                },
                'question_name_xpath': build_object_type(
                    additionalProperties=False,
                    properties={
                        'manual_transcription': build_object_type(
                            additionalProperties=False,
                            properties={
                                'language': GENERIC_STRING_SCHEMA,
                                'value': GENERIC_STRING_SCHEMA,
                            },
                            required=['language', 'value'],
                        ),
                        'manual_translation': build_array_type(
                            schema=build_object_type(
                                additionalProperties=False,
                                properties={
                                    'language': GENERIC_STRING_SCHEMA,
                                    'value': GENERIC_STRING_SCHEMA,
                                },
                                required=['language', 'value'],
                            ),
                            min_length=1,
                        ),
                        'qual': self._get_qual_schema()
                    },
                    anyOf=[
                        {'required': ['manual_transcription']},
                        {'required': ['manual_translation']},
                        {'required': ['qual']},
                    ],
                )
            }
        )

    @classmethod
    def _get_qual_schema(cls):
        qual_defs = {
            'qualCommon': {
                'type': 'object',
                'additionalProperties': False,
                'properties': {
                    'uuid': cls.UUID_STR,
                    'value': {},
                },
                'required': ['uuid', 'value'],
            },
            'qualInteger': {
                'type': 'object',
                'properties': {
                    'value': {
                        'type': 'integer',
                        'nullable': True,
                    },
                },
            },
            'qualText': {
                'type': 'object',
                'properties': {
                    'value': {'type': 'string'},
                },
            },
            'qualSelectOne': {
                'type': 'object',
                'properties': {
                    'value': cls.UUID_STR,
                },
            },
            'qualSelectMultiple': {
                'type': 'object',
                'properties': {
                    'value': {
                        'type': 'array',
                        'items': cls.UUID_STR,
                    },
                },
            },
        }

        return {
            'oneOf': [
                {
                    'allOf': [
                        qual_defs['qualCommon'],
                        qual_defs['qualInteger'],
                        {
                            'type': 'object',
                            'properties': {
                                'uuid': cls.UUID_STR,
                            },
                        },
                    ],
                },
                {
                    'allOf': [
                        qual_defs['qualCommon'],
                        qual_defs['qualText'],
                        {
                            'type': 'object',
                            'properties': {
                                'uuid': cls.UUID_STR,
                            },
                        },
                    ],
                },
                {
                    'allOf': [
                        qual_defs['qualCommon'],
                        qual_defs['qualSelectOne'],
                        {
                            'type': 'object',
                            'properties': {
                                'uuid': cls.UUID_STR,
                            },
                        },
                    ],
                },
                {
                    'allOf': [
                        qual_defs['qualCommon'],
                        qual_defs['qualSelectMultiple'],
                        {
                            'type': 'object',
                            'properties': {
                                'uuid': cls.UUID_STR,
                            },
                        },
                    ],
                },
            ],
        }


class DataSupplementResponseExtension(OpenApiSerializerExtension):
    target_class = 'kpi.schema_extensions.v2.data.serializers.DataSupplementResponse'

    DATETIME = build_basic_type(OpenApiTypes.DATETIME)
    UUID_STR = {'type': 'string', 'format': 'uuid'}

    def map_serializer(self, auto_schema, direction):
        # TODO move to class constants
        # Reusable building blocks to reduce redundancy
        LANG_STR = GENERIC_STRING_SCHEMA
        VALUE_STR = GENERIC_STRING_SCHEMA
        # DATETIME = build_basic_type(OpenApiTypes.DATETIME)

        # Constraint helper: "language" and "value" must be both present or both absent
        PAIR_LANG_VALUE_BOTH_OR_NONE = {
            'anyOf': [
                {'required': ['language', 'value']},  # both present
                {
                    'not': {  # forbid the cases where only one is present
                        'anyOf': [
                            {'required': ['language']},
                            {'required': ['value']},
                        ]
                    }
                },
            ]
        }

        # TODO move action schemas logic to their own methods.
        # Shared properties for objects that carry a language/value pair
        VALUE_PROPS = {
            'language': LANG_STR,
            'value': VALUE_STR,
        }

        # Generic revision item:
        # - requires _dateCreated;
        # - language/value are coupled (both-or-none)
        REVISION_ITEM = build_object_type(
            additionalProperties=False,
            properties={
                **VALUE_PROPS,
                '_dateCreated': self.DATETIME,  # Always required for a revision entry
            },
            required=['_dateCreated'],
            **PAIR_LANG_VALUE_BOTH_OR_NONE,
        )

        # Manual transcription object:
        # - _dateCreated and _dateModified are always required
        # - language/value: both-or-none
        # - "revisions" is an array of REVISION_ITEMs
        MANUAL_TRANSCRIPTION = build_object_type(
            additionalProperties=False,
            properties={
                **VALUE_PROPS,  # Coupled via PAIR_LANG_VALUE_BOTH_OR_NONE
                '_dateCreated': self.DATETIME,  # Always required
                '_dateModified': self.DATETIME,  # Always required
                'revisions': build_array_type(
                    schema=REVISION_ITEM,
                ),
            },
            required=['_dateCreated', '_dateModified'],
            **PAIR_LANG_VALUE_BOTH_OR_NONE,
        )

        # Each item in manual_translation:
        # - requires _dateCreated
        # - language/value: both-or-none
        # - has a "_revisions" array with the same REVISION_ITEM structure
        MANUAL_TRANSLATION_ITEM = build_object_type(
            additionalProperties=False,
            properties={
                **VALUE_PROPS,  # Coupled via PAIR_LANG_VALUE_BOTH_OR_NONE
                '_dateCreated': self.DATETIME,  # Always required
                '_revisions': build_array_type(
                    schema=REVISION_ITEM,
                ),
            },
            required=['_dateCreated'],
            **PAIR_LANG_VALUE_BOTH_OR_NONE,
        )

        MANUAL_TRANSLATION = build_array_type(
            schema=MANUAL_TRANSLATION_ITEM,
            min_length=1,
        )

        return build_object_type(
            properties={
                '_version': {
                    'type': 'string',
                    'example': '20250812',
                },
                'question_name_xpath': build_object_type(
                    additionalProperties=False,
                    properties={
                        'manual_transcription': MANUAL_TRANSCRIPTION,
                        'manual_translation': MANUAL_TRANSLATION,
                        'qual': self._get_qual_schema(),
                    },
                    # At least one of "manual_transcription" or "manual_translation" must be present
                    anyOf=[
                        {'required': ['manual_transcription']},
                        {'required': ['manual_translation']},
                        {'required': ['qual']},
                    ],
                ),
            }
        )

    @classmethod
    def _get_qual_schema(cls):
        """
        Build the OpenAPI schema for the `qual` field.
        """

        # ---------------------------------------------------------------------
        # qualCommon
        # ---------------------------------------------------------------------
        qual_common = build_object_type(
            additionalProperties=False,
            properties={
                'uuid': cls.UUID_STR,
                # "value" is intentionally untyped here: it will be refined
                # by the specific qual* schemas below.
                'value': {},
            },
            required=['uuid', 'value'],
        )

        # ---------------------------------------------------------------------
        # qualInteger
        #   properties: { value: integer | null }
        # ---------------------------------------------------------------------
        qual_integer = {
            'type': 'object',
            'properties': {
                'value': {
                    'type': 'integer',
                    'nullable': True,
                },
            },
        }

        # ---------------------------------------------------------------------
        # qualSelectMultiple
        #   properties: { value: ['507129be-2aee-4fb9-8ddd-ac766ba35f46', ...] }
        # ---------------------------------------------------------------------
        qual_select_multiple = {
            'type': 'object',
            'properties': {
                'value': {
                    'type': 'array',
                    'items': cls.UUID_STR,
                },
            },
        }

        # ---------------------------------------------------------------------
        # qualSelectOne
        #   properties: { value: '0bbdb149-c85c-46c2-ad31-583377c423da' }
        # ---------------------------------------------------------------------
        qual_select_one = {
            'type': 'object',
            'properties': {
                'value': cls.UUID_STR,
            },
        }

        # ---------------------------------------------------------------------
        # qualTags
        #   properties: { value: [string, ...] }
        # ---------------------------------------------------------------------
        qual_tags = {
            'type': 'object',
            'properties': {
                'value': {
                    'type': 'array',
                    'items': {
                        'type': 'string',
                    },
                },
            },
        }

        # ---------------------------------------------------------------------
        # qualText
        #   properties: { value: string }
        # ---------------------------------------------------------------------
        qual_text = {
            'type': 'object',
            'properties': {
                'value': {
                    'type': 'string',
                },
            },
        }

        # ---------------------------------------------------------------------
        # dataSchema
        #   oneOf:
        #     - allOf: [qualCommon, qualInteger]
        #     - allOf: [qualCommon, qualSelectMultiple]
        #     - allOf: [qualCommon, qualSelectOne]
        #     - allOf: [qualCommon, qualTags]
        #     - allOf: [qualCommon, qualText]
        #
        # We *do not* enforce "uuid: const <some-specific-uuid>" here
        # because in your use case UUIDs are dynamic (1..n).
        # ---------------------------------------------------------------------
        data_schema = {
            'oneOf': [
                {'allOf': [qual_common, qual_integer]},
                {'allOf': [qual_common, qual_select_multiple]},
                {'allOf': [qual_common, qual_select_one]},
                {'allOf': [qual_common, qual_tags]},
                {'allOf': [qual_common, qual_text]},
            ]
        }

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
                '_dateAccepted': cls.DATETIME,
                '_dateCreated': cls.DATETIME,
                '_uuid': cls.UUID_STR,
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
                '_dateCreated': cls.DATETIME,
                '_dateModified': cls.DATETIME,
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
            }
        )

        return qual_root


class DataValidationPayloadFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.DataValidationPayloadField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'submission_ids': build_array_type(
                    schema=build_basic_type(OpenApiTypes.INT)
                ),
                'validation_status.uid': GENERIC_STRING_SCHEMA,
            }
        )


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
