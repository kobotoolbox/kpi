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
    ASSET_URL_SCHEMA,
    GENERIC_ARRAY_SCHEMA,
    GENERIC_OBJECT_SCHEMA,
    GENERIC_STRING_SCHEMA,
    USER_URL_SCHEMA,
)
from kpi.utils.schema_extensions.url_builder import build_url_type
from .schema import (
    ADVANCED_FEATURES_SCHEMA,
    ASSIGNABLE_PERMISSION_SCHEMA,
    ASSET_CLONE_FROM_SCHEMA,
    ASSET_CONTENT_SCHEMA,
    ASSET_ENABLED_SCHEMA,
    ASSET_FIELDS_SCHEMA,
    ASSET_NAME_SCHEMA,
    ASSET_SETTINGS_SCHEMA,
    ASSET_TAG_STRING_SCHEMA,
    ASSET_TYPE_SCHEMA,
    BULK_ACTION_SCHEMA,
    BULK_ASSET_UIDS_SCHEMA,
    BULK_CONFIRM_SCHEMA,
    MAP_STYLES_SCHEMA,
    PERMISSION_ASSIGNMENT_SCHEMA,
    REPORT_STYLE_SCHEMA,
    SURVEY_CHOICE_SCHEMA,
    SURVEY_ROW_SCHEMA,
)


class AccessTypeFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.AccessTypeField'

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_ARRAY_SCHEMA


class AdvancedFeatureFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.AdvancedFeatureField'

    def map_serializer_field(self, auto_schema, direction):
        return ADVANCED_FEATURES_SCHEMA


class AdvancedSubmissionSchemaFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.assets.fields.AdvancedSubmissionSchemaField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'type': GENERIC_STRING_SCHEMA,
                '$description': GENERIC_STRING_SCHEMA,
            }
        )


class AnalysisFormJsonExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.AnalysisFormJsonField'

    def map_serializer_field(self, auto_schema, direction):
        # Define the structure for each additional_fields item
        additional_field_item = build_object_type(
            required=['source', 'type', 'name', 'dtpath'],
            properties={
                'language': GENERIC_STRING_SCHEMA,  # optional: two letter language code
                'source': GENERIC_STRING_SCHEMA,  # required: path to form question
                'type': {
                    'type': 'string',
                    'enum': [
                        'transcript',
                        'translation',
                        'qualVerification',
                        'qualSource',
                        'qualInteger',
                        'qualTags',
                        'qualText',
                        'qualNote',
                        'qualAutoKeywordCount',
                        'qualSelectMultiple',
                        'qualSelectOne',
                    ]
                },  # required: type of additional field
                'name': GENERIC_STRING_SCHEMA,  # required
                'dtpath': GENERIC_STRING_SCHEMA,  # required: data table path
                'label': GENERIC_STRING_SCHEMA,  # optional: question label or 'source'/'verified'
                'choices': build_array_type(
                    build_object_type(
                        required=['uuid', 'labels'],
                        properties={
                            'uuid': GENERIC_STRING_SCHEMA,
                            'labels': build_object_type(
                                required=['_default'],
                                properties={
                                    '_default': GENERIC_STRING_SCHEMA,
                                },
                                additionalProperties=GENERIC_STRING_SCHEMA,
                            ),  # {_default: string, [key: string]: string}
                        }
                    )
                ),  # optional: for single/multi choice qual questions
            }
        )

        return build_object_type(
            required=['additional_fields'],
            properties={
                'additional_fields': build_array_type(additional_field_item),
            }
        )


class AssetCloneFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.AssetCloneField'

    def map_serializer_field(self, auto_schema, direction):
        return ASSET_CLONE_FROM_SCHEMA


class AssetCreateRequestSerializerExtension(OpenApiSerializerExtension):

    target_class = 'kpi.schema_extensions.v2.assets.serializers.AssetCreateRequest'

    def map_serializer(self, auto_schema, direction):

        return {
            'oneOf': [
                build_object_type(
                    required=[
                        'name',
                        'clone_from',
                        'asset_type',
                    ],
                    properties={
                        'name': ASSET_NAME_SCHEMA,
                        'clone_from': ASSET_CLONE_FROM_SCHEMA,
                        'asset_type': ASSET_TYPE_SCHEMA,
                    },
                ),
                build_object_type(
                    required=[
                        'name',
                        'settings',
                        'asset_type',
                    ],
                    properties={
                        'name': ASSET_NAME_SCHEMA,
                        'settings': ASSET_SETTINGS_SCHEMA,
                        'asset_type': ASSET_TYPE_SCHEMA,
                    },
                ),
            ]
        }


class AssetPatchRequestSerializerExtension(OpenApiSerializerExtension):

    target_class = 'kpi.schema_extensions.v2.assets.serializers.AssetPatchRequest'

    def map_serializer(self, auto_schema, direction):

        return {
            'oneOf': [
                build_object_type(
                    required=['content', 'name'],
                    properties={
                        'content': ASSET_CONTENT_SCHEMA,
                        'name': ASSET_NAME_SCHEMA,
                    },
                ),
                build_object_type(
                    required=['enabled', 'fields'],
                    properties={
                        'enabled': ASSET_ENABLED_SCHEMA,
                        'fields': ASSET_FIELDS_SCHEMA,
                    },
                ),
                build_object_type(
                    required=['tag_string'],
                    properties={
                        'tag_string': ASSET_TAG_STRING_SCHEMA,
                    },
                ),
            ]
        }


class AssetFieldsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.AssetFieldsField'

    def map_serializer_field(self, auto_schema, direction):
        return ASSET_FIELDS_SCHEMA


class AssetURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.AssetURLField'

    def map_serializer_field(self, auto_schema, direction):
        return ASSET_URL_SCHEMA


class AssignablePermissionFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.AssignablePermissionField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(schema=ASSIGNABLE_PERMISSION_SCHEMA)


class AssetSettingsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.AssetSettingsField'

    def map_serializer_field(self, auto_schema, direction):
        return ASSET_SETTINGS_SCHEMA


class BulkActionFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.BulkActionField'

    def map_serializer(self, auto_schema, direction):
        return GENERIC_STRING_SCHEMA


class BulkAssetUidsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.BulkAssetUidsField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'asset_uids': build_array_type(
                    schema=GENERIC_OBJECT_SCHEMA,
                ),
            }
        )


class BulkConfirmFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.serializers.BulkAssetConfirmField'

    def map_serializer_field(self, auto_schema, direction):
        return build_basic_type(OpenApiTypes.BOOL)


class BulkPayloadSerializerExtension(OpenApiSerializerExtension):

    target_class = 'kpi.schema_extensions.v2.assets.serializers.AssetBulkRequest'

    def map_serializer(self, auto_schema, direction):

        return {
            'oneOf': [
                build_object_type(
                    required=['asset_uids', 'action'],
                    properties={
                        'asset_uids': BULK_ASSET_UIDS_SCHEMA,
                        'action': BULK_ACTION_SCHEMA,
                    },
                ),
                build_object_type(
                    required=['confirm', 'action'],
                    properties={
                        'confirm': BULK_CONFIRM_SCHEMA,
                        'action': BULK_ACTION_SCHEMA,
                    },
                ),
            ]
        }


class ChildrenFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.ChildrenField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'count': build_basic_type(OpenApiTypes.INT),
            }
        )


class ContentDataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.ContentDataField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'survey': build_array_type(
                    schema=GENERIC_OBJECT_SCHEMA,
                ),
                'settings': GENERIC_OBJECT_SCHEMA,
            }
        )


class ContentFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.ContentField'

    def map_serializer_field(self, auto_schema, direction):
        return ASSET_CONTENT_SCHEMA


class CountDailySubmissionResponseFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.CountDailySubmissionResponseField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                '2020-10-20': build_basic_type(OpenApiTypes.INT),
            }
        )


class CountriesFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.CountriesField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=GENERIC_ARRAY_SCHEMA,
        )


class DataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.DataURLField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:submission-list',
            uid_asset='aBeA23YCYjkGTFvYVHuAyU',
        )


class DataSharingFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.DataSharingField'

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_OBJECT_SCHEMA


class DeploymentDataDownloadLinksFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.assets.fields.DeploymentDataDownloadLinksField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            required=['csv_legacy', 'csv', 'kml_legacy', 'xls_legacy', 'xls', 'zip_legacy'],
            properties={
                'csv_legacy': GENERIC_STRING_SCHEMA,
                'csv': GENERIC_STRING_SCHEMA,
                'geojson': GENERIC_STRING_SCHEMA,  # optional
                'kml_legacy': GENERIC_STRING_SCHEMA,
                'spss_labels': GENERIC_STRING_SCHEMA,  # optional
                'xls_legacy': GENERIC_STRING_SCHEMA,
                'xls': GENERIC_STRING_SCHEMA,
                'zip_legacy': GENERIC_STRING_SCHEMA,
            }
        )


class DeploymentLinkFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.DeploymentLinkField'

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_OBJECT_SCHEMA


class DeployedVersionsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.DeployedVersionsField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            required=['count', 'next', 'previous', 'results'],
            properties={
                'count': build_basic_type(OpenApiTypes.INT),
                'next': {**GENERIC_STRING_SCHEMA, 'nullable': True},
                'previous': {**GENERIC_STRING_SCHEMA, 'nullable': True},
                'results': build_array_type(
                    schema=build_object_type(
                        required=['uid', 'url', 'content_hash', 'date_deployed', 'date_modified'],
                        properties={
                            'uid': GENERIC_STRING_SCHEMA,
                            'url': build_url_type(
                                'api_v2:asset-version-detail',
                                uid_asset='aBeA23YCYjkGTFvYVHuAyU',
                                uid_version='vBeA23YCYjkGTFvYVHuAyU',
                            ),
                            'content_hash': GENERIC_STRING_SCHEMA,
                            'date_deployed': build_basic_type(OpenApiTypes.DATETIME),
                            'date_modified': build_basic_type(OpenApiTypes.DATETIME),
                        }
                    )
                ),
            }
        )


class DownloadsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.DownloadsField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_object_type(
                required=['format', 'url'],
                properties={
                    'format': GENERIC_STRING_SCHEMA,
                    'url': GENERIC_STRING_SCHEMA,
                }
            )
        )


class EffectivePermissionFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.EffectivePermissionField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_object_type(
                properties={
                    'codename': GENERIC_STRING_SCHEMA,
                }
            )
        )


class ExportsURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.ExportsURLField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:asset-export-list',
            uid_asset='aBeA23YCYjkGTFvYVHuAyU',
        )


class FileListFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.FileListField'

    def map_serializer_field(self, auto_schema, direction):
        # Files is an array of AssetFileSerializer objects
        asset_file_schema = build_object_type(
            properties={
                'uid': GENERIC_STRING_SCHEMA,
                'url': GENERIC_STRING_SCHEMA,
                'asset': GENERIC_STRING_SCHEMA,
                'user': GENERIC_STRING_SCHEMA,
                'user__username': GENERIC_STRING_SCHEMA,
                'file_type': GENERIC_STRING_SCHEMA,
                'description': GENERIC_STRING_SCHEMA,
                'date_created': GENERIC_STRING_SCHEMA,
                'content': GENERIC_STRING_SCHEMA,
                'metadata': GENERIC_OBJECT_SCHEMA,
            }
        )
        return build_array_type(schema=asset_file_schema)


class HasDeploymentFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.HasDeploymentField'

    def map_serializer_field(self, auto_schema, direction):
        return build_basic_type(OpenApiTypes.BOOL)


class HooksURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.HooksUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:hook-list',
            uid_asset='aBeA23YCYjkGTFvYVHuAyU',
        )


class MapCustomFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.MapCustomField'

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_OBJECT_SCHEMA


class MapStylesFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.MapStylesField'

    def map_serializer_field(self, auto_schema, direction):
        return MAP_STYLES_SCHEMA


class MetadataListFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.MetadataListField'

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_ARRAY_SCHEMA


class MetadataSectorFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.MetadataSectorField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=GENERIC_ARRAY_SCHEMA,
        )


class UserURLRelativeHyperlinkedRelatedFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.UserURLRelativeHyperlinkedRelatedField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return USER_URL_SCHEMA


class PairedDataURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.PairedDataURLField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:paired-data-list', uid_asset='aBeA23YCYjkGTFvYVHuAyU'
        )


class ParentURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.ParentURLField'

    def map_serializer_field(self, auto_schema, direction):
        return ASSET_URL_SCHEMA


class PermissionsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.PermissionsField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(schema=PERMISSION_ASSIGNMENT_SCHEMA)


class ReportCustomFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.ReportCustomField'

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_OBJECT_SCHEMA


class ReportStyleFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.ReportStyleField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'default': REPORT_STYLE_SCHEMA,
                'specified': GENERIC_OBJECT_SCHEMA,  # additionalProperties pattern for dynamic row names
                'kuid_names': GENERIC_OBJECT_SCHEMA,  # additionalProperties pattern for dynamic row names
            }
        )


class ReportListFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.ReportListField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_object_type(
                properties={
                    'name': GENERIC_STRING_SCHEMA,
                    'row': build_object_type(
                        properties={
                            'type': GENERIC_STRING_SCHEMA,
                        },
                    ),
                    'data': build_object_type(
                        properties={
                            'total_count': build_basic_type(OpenApiTypes.INT),
                            'not_provided': build_basic_type(OpenApiTypes.INT),
                            'provided': build_basic_type(OpenApiTypes.INT),
                            'show_graph': build_basic_type(OpenApiTypes.BOOL),
                        }
                    ),
                    'kuid': GENERIC_STRING_SCHEMA,
                    'style': GENERIC_OBJECT_SCHEMA,
                }
            )
        )


class ReportURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.ReportURLField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            viewname='api_v2:asset-reports', uid_asset='a5owyo85mHyFazzgsZK45c'
        )


class SettingsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.SettingsField'

    def map_serializer_field(self, auto_schema, direction):
        # Sector can be: null (no selection), {} (empty default), or {label, value} (LabelValuePair)
        sector_schema = {
            **build_object_type(
                properties={
                    'label': GENERIC_STRING_SCHEMA,
                    'value': GENERIC_STRING_SCHEMA,
                }
            ),
            'nullable': True,
        }

        # Country is an array of {label, value} objects (LabelValuePair[]), nullable for form state
        label_value_pair_schema = build_object_type(
            properties={
                'label': GENERIC_STRING_SCHEMA,
                'value': GENERIC_STRING_SCHEMA,
            }
        )

        # collects_pii and operational_purpose are also LabelValuePair objects, nullable
        collects_pii_schema = {**label_value_pair_schema, 'nullable': True}
        operational_purpose_schema = {**label_value_pair_schema, 'nullable': True}

        return build_object_type(
            properties={
                'sector': sector_schema,
                'country': {**build_array_type(schema=label_value_pair_schema), 'nullable': True},
                'description': GENERIC_STRING_SCHEMA,
                'collects_pii': collects_pii_schema,
                'organization': {**GENERIC_STRING_SCHEMA, 'nullable': True},
                'country_codes': GENERIC_ARRAY_SCHEMA,
                'operational_purpose': operational_purpose_schema,
            }
        )


class SummaryFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.SummaryField'

    def map_serializer_field(self, auto_schema, direction):
        name_quality_first_item_schema = build_object_type(
            properties={
                'name': GENERIC_STRING_SCHEMA,
                'index': build_basic_type(OpenApiTypes.INT),
                'label': GENERIC_ARRAY_SCHEMA,
            }
        )
        name_quality_schema = build_object_type(
            properties={
                'ok': build_basic_type(OpenApiTypes.INT),
                'bad': build_basic_type(OpenApiTypes.INT),
                'good': build_basic_type(OpenApiTypes.INT),
                'total': build_basic_type(OpenApiTypes.INT),
                'firsts': build_object_type(
                    properties={
                        'ok': name_quality_first_item_schema,
                        'bad': name_quality_first_item_schema,
                    }
                ),
            }
        )
        return build_object_type(
            properties={
                'geo': build_basic_type(OpenApiTypes.BOOL),
                'labels': GENERIC_ARRAY_SCHEMA,
                'columns': GENERIC_ARRAY_SCHEMA,
                'lock_all': build_basic_type(OpenApiTypes.BOOL),
                'lock_any': build_basic_type(OpenApiTypes.BOOL),
                'languages': GENERIC_ARRAY_SCHEMA,
                'row_count': build_basic_type(OpenApiTypes.INT),
                'name_quality': name_quality_schema,
                'default_translation': {**GENERIC_STRING_SCHEMA, 'nullable': True},
                'naming_conflicts': build_array_type(GENERIC_STRING_SCHEMA),
            }
        )


class AssetHyperlinkedURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.AssetHyperlinkedURLField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('api_v2:asset-detail', uid_asset='aBeA23YCYjkGTFvYVHuAyU')


class ValidContentDataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.ValidContentDataField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'schema': GENERIC_STRING_SCHEMA,
                'survey': build_array_type(
                    schema=build_object_type(
                        properties={
                            'name': GENERIC_STRING_SCHEMA,
                            'type': GENERIC_STRING_SCHEMA,
                            '$kuid': GENERIC_STRING_SCHEMA,
                            '$xpath': GENERIC_STRING_SCHEMA,
                            '$autoname': GENERIC_STRING_SCHEMA,
                        },
                    )
                ),
                'settings': GENERIC_OBJECT_SCHEMA,
                'translated': GENERIC_ARRAY_SCHEMA,
                'translations': GENERIC_ARRAY_SCHEMA,
            }
        )


class XFormLinkFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.XFormLinkField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('api_v2:asset-xform', uid_asset='aBeA23YCYjkGTFvYVHuAyU')


class XLSLinkFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.XLSLinkField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('api_v2:asset-xls', uid_asset='aBeA23YCYjkGTFvYVHuAyU')
