from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    build_array_type,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type
from kpi.schema_extensions.v2.generic.schema import (
    GENERIC_ARRAY_SCHEMA, LABEL_VALUE_OBJECT_SCHEMA
)


class AssetLanguageFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.project_views.schema_extensions.v2.fields.AssetLanguageField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_ARRAY_SCHEMA


class AssetSettingsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.project_views.schema_extensions.v2.fields.AssetSettingsField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'sector': LABEL_VALUE_OBJECT_SCHEMA,
                'country': build_array_type(
                    schema=LABEL_VALUE_OBJECT_SCHEMA
                ),
                'description': build_basic_type(OpenApiTypes.STR),
                'collects_pii': build_basic_type(OpenApiTypes.STR),
                'organization': build_basic_type(OpenApiTypes.STR),
                'country_codes': GENERIC_ARRAY_SCHEMA,
                'operational_purpose': build_basic_type(OpenApiTypes.STR),
            }
        )


class AssetDownloadFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.project_views.schema_extensions.v2.fields.AssetDownloadField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_object_type(
                properties={
                    'format': build_basic_type(OpenApiTypes.STR),
                    'url': build_url_type(
                        'api_v2:asset-detail',
                        uid='aTPPUDScaFZkvBzd8FyK4Q',
                        format='xls',
                    ),
                }
            )
        )


class AssetsURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.project_views.schema_extensions.v2.fields.AssetsURLField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:projectview-assets', uid='pvyHWBnzRw3GCJpFs6cMdem'
        )


class AssetsExportURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.project_views.schema_extensions.v2.fields.AssetsExportURLField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:projectview-export',
            uid='pvyHWBnzRw3GCJpFs6cMdem',
            obj_type='assets',
        )


class ExportResponseResultExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.project_views.schema_extensions.v2.fields.ExportResponseResult'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'serve_private_file',
            path='bob/exports/assets-bob-view_pvyHWBnzRw3GCJpFs6cMdem-2025-07-18T124015Z.csv',  # noqa
        )


class GenericListFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.project_views.schema_extensions.v2.fields.GenericListField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_ARRAY_SCHEMA


class UrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.project_views.schema_extensions.v2.fields.UrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:projectview-detail', uid='pvyHWBnzRw3GCJpFs6cMdem'
        )


class UserMetadataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.project_views.schema_extensions.v2.fields.UserMetadataField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'city': build_basic_type(OpenApiTypes.STR),
                'name': build_basic_type(OpenApiTypes.STR),
                'sector': build_basic_type(OpenApiTypes.STR),
                'country': build_basic_type(OpenApiTypes.STR),
                'organization': build_basic_type(OpenApiTypes.STR),
                'last_ui_language': build_basic_type(OpenApiTypes.STR),
                'organization_type': build_basic_type(OpenApiTypes.STR),
                'organization_website': build_basic_type(OpenApiTypes.STR),
                'project_view_settings': build_object_type(
                    properties={
                        'my_project_view_name': build_object_type(
                            properties={
                                'order': build_object_type(properties={}),
                                'fields': GENERIC_ARRAY_SCHEMA,
                                'filters': GENERIC_ARRAY_SCHEMA,
                            }
                        )
                    }
                ),
            }
        )


class UserURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.project_views.schema_extensions.v2.fields.UserURLField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:projectview-users',
            uid='pvyHWBnzRw3GCJpFs6cMdem',
        )


class UserExportURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.project_views.schema_extensions.v2.fields.UserExportURLField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:projectview-export', uid='pvyHWBnzRw3GCJpFs6cMdem', obj_type='users'
        )
