from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_object_type, build_basic_type, build_array_type
from drf_spectacular.types import OpenApiTypes
from rest_framework import serializers

from kpi.utils.schema_extensions.url_builder import build_url_type
from .schema import ASSET_NAME, ASSET_TYPE, ASSET_CLONE_FROM, ASSET_SETTINGS, ASSET_URL_SCHEMA, BULK_ASSET_UIDS, BULK_ACTION, BULK_CONFIRM


class AdvancedFeatureFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.AdvancedFeatureField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={}
        )


class AdvancedSubmissionSchemaFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.AdvancedSubmissionSchemaField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'type': build_basic_type(OpenApiTypes.STR),
                '$description': build_basic_type(OpenApiTypes.STR),
            }
        )


class AnalysisFormJsonExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.AnalysisFormJsonField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'engines': build_object_type(properties={}),
                'additional_fields': build_array_type(schema={}),
            }
        )


class AssetURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.AssetURLField'

    def map_serializer_field(self, auto_schema, direction):
        return ASSET_URL_SCHEMA


class AssignablePermissionFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.AssignablePermissionField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_object_type(
                properties={}
            )
        )


class AssetCreateRequestSerializerExtension(OpenApiSerializerFieldExtension):

    target_class = 'kpi.schema_extensions.v2.assets.serializers.AssetCreateRequest'

    def map_serializer(self, auto_schema, direction):

        return {
            'oneOf': [
                build_object_type(
                    properties={
                        'name': ASSET_NAME,
                        'clone_from': ASSET_CLONE_FROM,
                        'asset_type': ASSET_TYPE,
                    }
                ),
                build_object_type(
                    properties={
                        'name': ASSET_NAME,
                        'settings': ASSET_SETTINGS,
                        'asset_type': ASSET_TYPE,
                    }
                ),
            ]
        }


class BulkPayloadSerializerExtension(OpenApiSerializerFieldExtension):

    target_class = 'kpi.schema_extensions.v2.assets.serializers.AssetBulkRequest'

    def map_serializer(self, auto_schema, direction):

        return {
            'oneOf': [
                build_object_type(
                    properties={
                        'asset_uids': BULK_ASSET_UIDS,
                        'action': BULK_ACTION,
                    }
                ),
                build_object_type(
                    properties={
                        'confirm': BULK_CONFIRM,
                        'action': BULK_ACTION,
                    }
                ),
            ]
        }


class BulkActionFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.serializers.BulkActionField'

    def map_serializer(self, auto_schema, direction):
        return build_object_type(properties={})


class BulkAssetUidsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.serializers.BulkAssetUidsField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'asset_uids': build_array_type(
                    schema=build_object_type(
                        properties={},
                    ),
                ),
            }
        )


class BulkConfirmFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.serializers.BulkAssetConfirmField'

    def map_serializer_field(self, auto_schema, direction):
        return build_basic_type(OpenApiTypes.BOOL)


class AssetSettingsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.AssetSettingsField'

    def map_serializer_field(self, auto_schema, direction):
        return ASSET_SETTINGS


class AssetCloneFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.AssetCloneField'

    def map_serializer_field(self, auto_schema, direction):
        return ASSET_CLONE_FROM


class AssetUpdateRequestFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.AssetUpdateField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'enabled': build_basic_type(OpenApiTypes.BOOL),
                'fields': build_array_type(schema={}),
            }
        )


class ChildrenFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.ChildrenField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'count': build_basic_type(OpenApiTypes.INT),
            }
        )


class ContentFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.ContentField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'schema': build_basic_type(OpenApiTypes.STR),
                'survey': build_array_type(
                    schema=build_object_type(
                        properties={}
                    )
                ),
                'settings': build_object_type(properties={}),
                'translated': build_array_type(schema={}),
                'translations': build_array_type(schema={}),
            }
        )


class CountDailySubmissionResponseFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.CountDailySubmissionResponseField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                '2020-10-20': build_basic_type(OpenApiTypes.INT),
            }
        )


class ContentDataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.ContentDataField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'survey': build_array_type(schema={}),
                'settings': build_object_type(properties={}),
            }
        )


class DataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.DataURLField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:submission-list',
            parent_lookup_asset='aBeA23YCYjkGTFvYVHuAyU',
        )


class DataSharingFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.DataSharingField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={}
        )


class DeploymentActiveFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.DeploymentActiveField'
    def map_serializer_field(self, auto_schema, direction):
        return build_basic_type(OpenApiTypes.BOOL)


class DeploymentLinkFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.DeploymentLinkField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={}
        )


class DeploymentDataDownloadLinksFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.DeploymentDataDownloadLinksField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={}
        )


class DeploymentSubmissionCountFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.DeploymentSubmissionCountField'
    def map_serializer_field(self, auto_schema, direction):
        return build_basic_type(OpenApiTypes.INT)


class DeployedVersionFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.DeployedVersionField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'count': build_basic_type(OpenApiTypes.INT),
                'next': build_basic_type(OpenApiTypes.STR),
                'previous': build_basic_type(OpenApiTypes.STR),
                'results': build_array_type(
                    schema= build_object_type(
                        properties={
                            'uid': build_basic_type(OpenApiTypes.STR),
                            'url': build_url_type(
                                'asset-detail',
                                uid='aBeA23YCYjkGTFvYVHuAyU',
                            ),
                            'content_hash': build_basic_type(OpenApiTypes.STR),
                            'date_deployed': build_basic_type(OpenApiTypes.DATETIME),
                            'date_modified': build_basic_type(OpenApiTypes.DATETIME),
                        }
                    )
                )
            }
        )


class DownloadsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.DownloadsField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_object_type(
                properties={
                    'format': build_basic_type(OpenApiTypes.STR),
                    'url': build_basic_type(OpenApiTypes.STR),
                }
            )
        )


class EffectivePermissionFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.EffectivePermissionField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_object_type(
                properties={
                    'codename': build_basic_type(OpenApiTypes.STR),
                }
            )
        )


class ExportsURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.ExportsURLField'
    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:asset-export-list',
            parent_lookup_asset='aBeA23YCYjkGTFvYVHuAyU',
        )


class FileListFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.FileListField'
    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(schema={})


class HasDeploymentFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.HasDeploymentField'
    def map_serializer_field(self, auto_schema, direction):
        return build_basic_type(OpenApiTypes.BOOL)


class HooksURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.HooksUrlField'
    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:hook-list',
            parent_lookup_asset='aBeA23YCYjkGTFvYVHuAyU',
        )


class MapStylesFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.MapStylesField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={}
        )


class MapCustomFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.MapCustomField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={}
        )


class PermissionsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.PermissionsField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema={}
        )


class UserURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.UserURLField'
    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('asset-detail', uid='aBeA23YCYjkGTFvYVHuAyU')


class ReportCustomFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.ReportCustomField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={}
        )


class ReportStyleFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.ReportStyleField'
    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'default': build_object_type(properties={}),
                'specified': build_object_type(
                    properties={
                        'end': build_object_type(properties={}),
                        'start': build_object_type(properties={}),
                    }
                ),
                'kuid_names': build_object_type(
                    properties={
                        'end': build_basic_type(OpenApiTypes.STR),
                        'start': build_basic_type(OpenApiTypes.STR),
                    }
                ),
            }
        )


class OwnerURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.OwnerURLField'
    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('user-kpi-detail', username='bob')


class PairedDataURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.PairedDataURLField'
    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:paired-data-list',
            parent_lookup_asset='aBeA23YCYjkGTFvYVHuAyU'
        )


class ReportListFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.ReportListField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_object_type(
                properties={
                    'name': build_basic_type(OpenApiTypes.STR),
                    'row': build_object_type(
                        properties={
                            'type': build_basic_type(OpenApiTypes.STR),
                        },
                    ),
                    'data': build_object_type(
                        properties={
                            'total_count': build_basic_type(OpenApiTypes.INT),
                            'not_provided': build_basic_type(OpenApiTypes.INT),
                            'provided': build_basic_type(OpenApiTypes.INT),
                            'show_graph': build_basic_type(OpenApiTypes.BOOL)
                        }
                    ),
                    'kuid': build_basic_type(OpenApiTypes.STR),
                    'style': build_object_type(properties={}),
                }
            )
        )


class ReportURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.ReportURLField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(viewname='api_v2:asset-detail', uid='a5owyo85mHyFazzgsZK45c')


class SettingsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.SettingsField'
    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'sector': build_object_type(properties={}),
                'country': build_array_type(schema={}),
                'description': build_basic_type(OpenApiTypes.STR),
                'collects_pii': build_basic_type(OpenApiTypes.STR),
                'organization': build_basic_type(OpenApiTypes.STR),
                'country_codes': build_array_type(schema={}),
                'operational_purpose': build_basic_type(OpenApiTypes.STR),
            }
        )


class SubscribersCountFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.SubscribersCountField'
    def map_serializer_field(self, auto_schema, direction):
        return build_basic_type(OpenApiTypes.INT)


class SummaryFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.SummaryField'
    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'geo': build_basic_type(OpenApiTypes.BOOL),
                'labels': build_array_type(schema={}),
                'columns': build_array_type(schema={}),
                'lock_all': build_basic_type(OpenApiTypes.BOOL),
                'lock_any': build_basic_type(OpenApiTypes.BOOL),
                'languages': build_array_type(schema={}),
                'row_count': build_basic_type(OpenApiTypes.INT),
                'name_quality': build_object_type(properties={}),
                'default_translation': build_basic_type(OpenApiTypes.STR),
            }
        )


class VersionCountFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.VersionCountField'
    def map_serializer_field(self, auto_schema, direction):
        return build_basic_type(OpenApiTypes.INT)


class XLSLinkFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.XLSLinkField'
    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('api_v2:asset-xls', uid='aBeA23YCYjkGTFvYVHuAyU')


class XFormLinkFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.assets.fields.XFormLinkField'
    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('api_v2:asset-xform', uid='aBeA23YCYjkGTFvYVHuAyU')
