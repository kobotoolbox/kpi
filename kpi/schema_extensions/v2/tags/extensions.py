from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_array_type

from kpi.utils.schema_extensions.url_builder import build_url_type


class AssetListFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.tags.fields.AssetListField'

    def map_serializer_field(self, auto_schema, direction):
        return build_array_type(
            schema=build_url_type('api_v2:asset-detail', uid='a5owyo85mHyFazzgsZK45c')
        )


class TagUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.tags.fields.TagUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('tags-detail', taguid__uid='tg3c5giitsQUMCJNNoDEpQ')


class ParentUrlFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.tags.fields.ParentUrlField'

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type('tags-list')
