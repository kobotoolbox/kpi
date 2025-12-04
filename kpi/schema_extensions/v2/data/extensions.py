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
                                    'translation': GENERIC_STRING_SCHEMA,
                                },
                                required=['language', 'value'],
                            ),
                            min_length=1,
                        )
                    },
                    anyOf=[
                        {'required': ['manual_transcription']},
                        {'required': ['manual_translation']},
                    ],
                ),
            }
        )


class DataSupplementResponseExtension(OpenApiSerializerExtension):
    target_class = 'kpi.schema_extensions.v2.data.serializers.DataSupplementResponse'

    def map_serializer(self, auto_schema, direction):
        # Reusable building blocks to reduce redundancy
        LANG_STR = GENERIC_STRING_SCHEMA
        VALUE_STR = GENERIC_STRING_SCHEMA
        DATETIME = build_basic_type(OpenApiTypes.DATETIME)

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
                '_dateCreated': DATETIME,  # Always required for a revision entry
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
                '_dateCreated': DATETIME,  # Always required
                '_dateModified': DATETIME,  # Always required
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
                '_dateCreated': DATETIME,  # Always required
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
                    },
                    # At least one of "manual_transcription" or "manual_translation" must be present
                    anyOf=[
                        {'required': ['manual_transcription']},
                        {'required': ['manual_translation']},
                    ],
                ),
            }
        )


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
