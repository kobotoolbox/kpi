from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_basic_type, build_object_type
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type


class AssetsURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.audit_log.schema_extensions.v2.access_logs.fields.AssetsURLField'  # noqa
    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:projectview-assets',
            uid='pvyHWBnzRw3GCJpFs6cMdem'
        )


class AssetsExportURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.audit_log.schema_extensions.v2.access_logs.fields.AssetsExportURLField'  # noqa
    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:projectview-export',
            uid='pvyHWBnzRw3GCJpFs6cMdem',
            obj_type='assets'
        )


class ExportResponseResultExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.audit_log.schema_extensions.v2.access_logs.fields.ExportResponseResult'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'serve_private_file',
            path='bob/exports/assets-bob-view_pvyHWBnzRw3GCJpFs6cMdem-2025-07-18T124015Z.csv'
        )


class UrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.audit_log.schema_extensions.v2.access_logs.fields.UrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:projectview-detail',
            uid='pvyHWBnzRw3GCJpFs6cMdem'
        )


class UserURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.audit_log.schema_extensions.v2.access_logs.fields.UserURLField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:projectview-users',
            uid='pvyHWBnzRw3GCJpFs6cMdem',
        )


class UserExportURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.audit_log.schema_extensions.v2.access_logs.fields.UserExportURLField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:projectview-export',
            uid='pvyHWBnzRw3GCJpFs6cMdem',
            obj_type='users'
        )
