from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import build_array_type, ResolvedComponent

from kobo.apps.subsequences.actions import ACTIONS
from kpi.schema_extensions.v2.generic.schema import GENERIC_OBJECT_SCHEMA


class SubsequenceParamsFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.subsequences.fields.AdvancedFeatureParamsField'  # noqa

    def map_serializer_field(self, auto_schema, direction):
        refs = []
        for action in ACTIONS:
            component = ResolvedComponent(
                name=action.ID+'Params',
                schema=action.params_schema,
                type=ResolvedComponent.SCHEMA,
                object=dict,
            )
            auto_schema.registry.register_on_missing(component)
            refs.append(component.ref)

        return build_array_type(
            schema={
                "anyOf": refs
            }
        )
