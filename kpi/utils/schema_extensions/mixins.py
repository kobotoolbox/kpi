from drf_spectacular.plumbing import ResolvedComponent


class ComponentRegistrationMixin:
    """
    Helper mixin for OpenApiSerializerExtension to register ad-hoc schema
    components and return a stable $ref.

    The extension instance (`self`) is intentionally used as the component
    source object to associate the newly registered schema component with
    the serializer extension that defines it.
    """

    def _register_schema_component(self, auto_schema, name, schema):
        component = ResolvedComponent(
            name=name,
            type=ResolvedComponent.SCHEMA,
            schema=schema,
            object=self,
        )

        auto_schema.registry.register(component)
        return component.ref
