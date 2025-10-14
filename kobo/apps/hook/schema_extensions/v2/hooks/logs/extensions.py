from drf_spectacular.extensions import OpenApiSerializerFieldExtension

from kpi.schema_extensions.v2.generic.schema import GENERIC_ARRAY_SCHEMA
from kpi.utils.schema_extensions.url_builder import build_url_type


class HookLogURLFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.hook.schema_extensions.v2.hooks.logs.fields.HookLogURLField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return build_url_type(
            'api_v2:hook-log-detail',
            uid_asset='aTPPUDScaFZkvBzd8FyK4Q',
            uid_hook='hsw3Ec5vz7Lqg7TrwrxdaS',
            uid_log='hl8Ldv5m84SBpU5UB5J7QBD',
        )


class PendingUidsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = (
        'kobo.apps.hook.schema_extensions.v2.hooks.logs.fields.PendingUidsField'
    )

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_ARRAY_SCHEMA
