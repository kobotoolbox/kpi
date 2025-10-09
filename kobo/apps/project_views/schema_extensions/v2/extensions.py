from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_array_type, build_object_type

from kpi.schema_extensions.v2.generic.schema import (
    GENERIC_ARRAY_SCHEMA,
    GENERIC_OBJECT_SCHEMA,
    GENERIC_STRING_SCHEMA,
    LABEL_VALUE_OBJECT_SCHEMA,
)
from kpi.utils.schema_extensions.url_builder import build_url_type


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
                'country': build_array_type(schema=LABEL_VALUE_OBJECT_SCHEMA),
                'description': GENERIC_STRING_SCHEMA,
                'collects_pii': GENERIC_STRING_SCHEMA,
                'organization': GENERIC_STRING_SCHEMA,
                'country_codes': GENERIC_ARRAY_SCHEMA,
                'operational_purpose': GENERIC_STRING_SCHEMA,
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
                    'format': GENERIC_STRING_SCHEMA,
                    'url': build_url_type(
                        'api_v2:asset-detail',
                        uid_asset='aTPPUDScaFZkvBzd8FyK4Q',
                        format='xls',
                    ),
                }
            )
        )


class AssetsURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.project_views.schema_extensions.v2.fields.AssetsURLField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:projectview-assets', uid_project_view='pvyHWBnzRw3GCJpFs6cMdem'
        )


class AssetsExportURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.project_views.schema_extensions.v2.fields.AssetsExportURLField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:projectview-export',
            uid_project_view='pvyHWBnzRw3GCJpFs6cMdem',
            obj_type='assets',
        )


class ExportResponseResultExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.project_views.schema_extensions.v2.fields.ExportResponseResult'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'serve_private_file',
            username='bob',
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
            'api_v2:projectview-detail', uid_project_view='pvyHWBnzRw3GCJpFs6cMdem'
        )


class UserMetadataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.project_views.schema_extensions.v2.fields.UserMetadataField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'city': GENERIC_STRING_SCHEMA,
                'name': GENERIC_STRING_SCHEMA,
                'sector': GENERIC_STRING_SCHEMA,
                'country': GENERIC_STRING_SCHEMA,
                'organization': GENERIC_STRING_SCHEMA,
                'last_ui_language': GENERIC_STRING_SCHEMA,
                'organization_type': GENERIC_STRING_SCHEMA,
                'organization_website': GENERIC_STRING_SCHEMA,
                'project_view_settings': build_object_type(
                    properties={
                        'my_project_view_name': build_object_type(
                            properties={
                                'order': GENERIC_OBJECT_SCHEMA,
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
            uid_project_view='pvyHWBnzRw3GCJpFs6cMdem',
        )


class UserExportURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.project_views.schema_extensions.v2.fields.UserExportURLField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:projectview-export',
            uid_project_view='pvyHWBnzRw3GCJpFs6cMdem',
            obj_type='users',
        )
