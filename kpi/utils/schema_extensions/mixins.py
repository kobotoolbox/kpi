from typing import Any

from drf_spectacular.openapi import AutoSchema
from drf_spectacular.plumbing import ResolvedComponent, ComponentIdentity


class ComponentRegistrationMixin:
    """
    Helper mixin for OpenApiSerializerExtension to register ad-hoc schema
    components and return a stable $ref.

    The extension instance (`self`) is intentionally used as the component
    source object to associate the newly registered schema component with
    the serializer extension that defines it.
    """

    def _register_schema_component(
        self,
        auto_schema: AutoSchema,
        name: str,
        schema: dict,
        query_object: Any = None
    ):
        component = ResolvedComponent(
            name=name,
            type=ResolvedComponent.SCHEMA,
            schema=schema,
            object=query_object or ComponentIdentity(name),
        )

        auto_schema.registry.register_on_missing(component)
        return component.ref
