from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_basic_type, build_object_type, build_array_type
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type


class MetadataFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.audit_log.schema_extensions.v2.audit_logs.fields.MetadataField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'source': build_basic_type(OpenApiTypes.STR),
                'asset_uid': build_basic_type(OpenApiTypes.STR),
                'ip_address': build_basic_type(OpenApiTypes.STR),
                'log_subtype': build_basic_type(OpenApiTypes.STR),
                'paired-data': build_object_type(
                    properties={
                        'fields': build_array_type(build_basic_type(OpenApiTypes.STR)),
                        'source_uid': build_basic_type(OpenApiTypes.STR),
                        'source_name': build_basic_type(OpenApiTypes.STR),
                    }
                ),
                'project_owner': build_basic_type(OpenApiTypes.STR),
            }
        )


class UserFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kobo.apps.audit_log.schema_extensions.v2.audit_logs.fields.UserField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('api_v2:user-kpi-detail', username='bob')
