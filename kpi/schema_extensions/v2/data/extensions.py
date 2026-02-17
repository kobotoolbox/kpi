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

from kpi.schema_extensions.v2.data.mixins import (
    SupplementalDataComponentsRegistrationMixin,
)
from kpi.schema_extensions.v2.generic.schema import (
    GENERIC_INT_SCHEMA,
    GENERIC_STRING_SCHEMA,
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
                    'media_file_basename': GENERIC_STRING_SCHEMA,
                    'filename': GENERIC_STRING_SCHEMA,
                    'uid': GENERIC_STRING_SCHEMA,
                    'question_xpath': GENERIC_STRING_SCHEMA,
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
        return build_array_type(schema=GENERIC_INT_SCHEMA)


class DataBulkUpdatePayloadFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.data.fields.DataBulkUpdatePayloadField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'submission_ids': build_array_type(schema=GENERIC_INT_SCHEMA),
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
                    'status_code': GENERIC_INT_SCHEMA,
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
            },
            anyOf=[
                {'required': ['manual_transcription']},
                {'required': ['manual_translation']},
                {'required': ['automatic_google_transcription']},
                {'required': ['automatic_google_translation']},
                {'required': ['manual_qual']},
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
                references['qual_integer'],
                references['qual_text'],
                references['qual_select_one'],
                references['qual_select_multiple'],
                references['qual_tags'],
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
    QualComponentsRegistrationMixin,
    SupplementalDataComponentsRegistrationMixin,
    OpenApiSerializerExtension,
):
    target_class = 'kpi.schema_extensions.v2.data.serializers.DataSupplementResponse'

    def question_schema(self, references, supp_references):

        return build_object_type(
            additionalProperties=False,
            properties={
                'manual_transcription': supp_references['action_object_manual'],
                'manual_translation': supp_references['translation_map_manual'],
                'automatic_google_transcription': supp_references[
                    'action_object_automatic'
                ],
                'automatic_google_translation': supp_references[
                    'translation_map_automatic'
                ],
                'manual_qual': supp_references['qual_map'],
            },
            # At least one of "manual_transcription" or "manual_translation"
            # must be present
            anyOf=[
                {'required': ['manual_transcription']},
                {'required': ['manual_translation']},
                {'required': ['automatic_google_transcription']},
                {'required': ['automatic_google_translation']},
                {'required': ['manual_qual']},
            ],
        )

    def map_serializer(self, auto_schema, direction):
        references = self._register_qual_schema_components(auto_schema)
        supp_references = self._register_supplemental_data_components(
            auto_schema, qual_references=references
        )

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
                self.question_schema(references, supp_references),
            ),
            patternProperties={
                '^(?!_version$).*': self._register_schema_component(
                    auto_schema,
                    'DataSupplementResponseOneOf',
                    self.question_schema(references, supp_references),
                ),
            },
            required=['_version'],
        )


class DataSupplementalDetailsFieldExtension(
    QualComponentsRegistrationMixin,
    SupplementalDataComponentsRegistrationMixin,
    OpenApiSerializerFieldExtension,
):
    """
    OpenAPI schema extension for DataResponse._supplementalDetails field.

    Generates a oneOf union of all possible action types, enabling TypeScript
    to generate proper union types instead of generic { [key: string]: unknown }.

    Pattern based on DataSupplementResponseExtension.
    """

    target_class = 'kpi.schema_extensions.v2.data.fields.DataSupplementalDetailsField'

    def map_serializer_field(self, auto_schema, direction):
        """
        Map the custom field to a oneOf union schema.

        Returns an OpenAPI schema with oneOf containing all 5 action type schemas.
        Each action schema is a named component for proper TypeScript generation.
        """
        references = self._register_qual_schema_components(auto_schema)
        supp_references = self._register_supplemental_data_components(
            auto_schema, qual_references=references
        )

        return {
            'oneOf': [
                self._register_schema_component(
                    auto_schema,
                    'SupplementalDetailsManualTranscription',
                    build_object_type(
                        additionalProperties=build_object_type(
                            properties={
                                'manual_transcription': supp_references[
                                    'action_object_manual'
                                ],
                            },
                            required=['manual_transcription'],
                        ),
                        description='Manual transcription supplemental details',
                    ),
                ),
                self._register_schema_component(
                    auto_schema,
                    'SupplementalDetailsManualTranslation',
                    build_object_type(
                        additionalProperties=build_object_type(
                            properties={
                                'manual_translation': supp_references[
                                    'translation_map_manual'
                                ],
                            },
                            required=['manual_translation'],
                        ),
                        description='Manual translation supplemental details',
                    ),
                ),
                self._register_schema_component(
                    auto_schema,
                    'SupplementalDetailsAutomaticTranscription',
                    build_object_type(
                        additionalProperties=build_object_type(
                            properties={
                                'automatic_google_transcription': supp_references[
                                    'action_object_automatic'
                                ],
                            },
                            required=['automatic_google_transcription'],
                        ),
                        description='Automatic transcription supplemental details',
                    ),
                ),
                self._register_schema_component(
                    auto_schema,
                    'SupplementalDetailsAutomaticTranslation',
                    build_object_type(
                        additionalProperties=build_object_type(
                            properties={
                                'automatic_google_translation': supp_references[
                                    'translation_map_automatic'
                                ],
                            },
                            required=['automatic_google_translation'],
                        ),
                        description='Automatic translation supplemental details',
                    ),
                ),
                self._register_schema_component(
                    auto_schema,
                    'SupplementalDetailsManualQual',
                    build_object_type(
                        additionalProperties=build_object_type(
                            properties={
                                'manual_qual': supp_references['qual_map'],
                            },
                            required=['manual_qual'],
                        ),
                        description='Manual qualitative supplemental details',
                    ),
                ),
                # Future: Add automatic_bedrock_qual when needed
            ],
            'nullable': True,  # Field is required=False
            'description': (
                'Action-specific supplemental data attached to this submission. '
                'Structure varies by action type (transcription, translation, qual). '
                'Top-level keys are question XPaths, values are action-specific objects.'
            ),
        }

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
