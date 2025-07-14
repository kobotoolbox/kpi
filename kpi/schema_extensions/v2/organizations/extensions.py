from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_basic_type, build_object_type
from drf_spectacular.types import OpenApiTypes


class AssetUsageFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kpi.schema_extensions.v2.organizations.fields.AssetUsageField'  # noqa
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'uuid': build_basic_type(OpenApiTypes.STR),
            }
        )
