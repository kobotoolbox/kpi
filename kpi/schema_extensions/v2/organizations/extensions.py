from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_basic_type, build_object_type
from drf_spectacular.types import OpenApiTypes

from kpi.utils.schema_extensions.url_builder import build_url_type


class AssetFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.organizations.fields.AssetField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:organizations-assets',
            id='orgzeph7Ub8tVmJ82JBbH96n',
        )


class AssetUsageFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.organizations.fields.AssetUsageField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:organizations-asset-usage',
            id='orgzeph7Ub8tVmJ82JBbH96n',
        )


class IsOwnerFieldExtensions(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.organizations.fields.IsOwnerField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_basic_type(OpenApiTypes.BOOL)


class MembersFieldExtensions(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.organizations.fields.MembersField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:organization-members-list',
            organization_id='orgzeph7Ub8tVmJ82JBbH96n',
        )


class RequestUserRoleFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.organizations.fields.RequestUserRoleField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_basic_type(OpenApiTypes.STR)


class ServiceUsageFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.organizations.fields.ServiceUsageField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:organizations-service-usage',
            id='orgzeph7Ub8tVmJ82JBbH96n',
        )


class UrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.organizations.fields.UrlField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:organizations-detail',
            id='orgzeph7Ub8tVmJ82JBbH96n',
        )
