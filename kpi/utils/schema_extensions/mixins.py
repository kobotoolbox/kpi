from typing import Any

from drf_spectacular.openapi import AutoSchema
from drf_spectacular.plumbing import (
    ComponentIdentity,
    ResolvedComponent,
    build_object_type,
)

from kpi.schema_extensions.v2.generic.schema import GENERIC_UUID_SCHEMA


class ComponentRegistrationMixin:
    """
    Helper mixin for OpenApiSerializerExtension to register ad-hoc schema
    components and return a stable $ref.

    The extension instance (`self`) is intentionally used as the component
    source object to associate the newly registered schema component with
    the serializer extension that defines it.
    """

    def _register_schema_component(
        self, auto_schema: AutoSchema, name: str, schema: dict, query_object: Any = None
    ):
        component = ResolvedComponent(
            name=name,
            type=ResolvedComponent.SCHEMA,
            schema=schema,
            object=query_object or ComponentIdentity(name),
        )

        auto_schema.registry.register_on_missing(component)
        return component.ref


class QualComponentsRegistrationMixin(ComponentRegistrationMixin):

    def _register_qual_schema_components(self, auto_schema):
        references = {}

        value_by_type = {
            'integer': {'type': 'integer', 'nullable': True},
            'select_multiple': {'type': 'array', 'items': GENERIC_UUID_SCHEMA},
            'select_one': GENERIC_UUID_SCHEMA,
            'text': {'type': 'string'},
            'tags': {'type': 'array', 'items': {'type': 'string'}},
        }
        # ---------------------------------------------------------------------
        # qualInteger
        #   properties: { value: integer | null }
        # ---------------------------------------------------------------------
        schema_base = {
            'type': 'object',
            'additionalProperties': False,
        }
        for q_type in ['integer', 'text', 'select_one', 'select_multiple', 'tags']:
            title_case = (q_type.title().replace('_', ''),)
            manual_schema = {
                **schema_base,
                'properties': {
                    'value': value_by_type[q_type],
                    'uuid': GENERIC_UUID_SCHEMA,
                },
                'required': ['uuid', 'value'],
            }
            references[f'manual_qual_{q_type}'] = self._register_schema_component(
                auto_schema,
                f'DataSupplementManualQualData{title_case}',
                schema=manual_schema,
            )
            if q_type != 'tags':
                automatic_schema = {
                    **schema_base,
                    'oneOf': [
                        build_object_type(
                            additionalProperties=False,
                            properties={
                                'uuid': GENERIC_UUID_SCHEMA,
                                'value': value_by_type[q_type],
                                'status': {
                                    'type': 'string',
                                    'const': 'complete',
                                },
                            },
                            required=['uuid', 'value', 'status'],
                        ),
                        build_object_type(
                            additionalProperties=False,
                            properties={
                                'uuid': GENERIC_UUID_SCHEMA,
                                'status': {
                                    'type': 'string',
                                    'const': 'failed',
                                },
                                'error': {'type': 'string'},
                            },
                            required=['status', 'error', 'uuid'],
                        ),
                    ],
                }

                references[f'automatic_qual_{q_type}'] = (
                    self._register_schema_component(
                        auto_schema,
                        f'DataSupplementAutomaticQualData{title_case}Response',
                        schema=automatic_schema,
                    )
                )
        uuid_only = {
            **schema_base,
            'properties': {
                'uuid': GENERIC_UUID_SCHEMA
            },
            'required': ['uuid'],
        }
        references['automatic_qual_payload'] = self._register_schema_component(
            auto_schema,
            # match the naming convention drf-spectacular/Orval uses for the other
            # question types
            'PatchedDataSupplementPayloadOneOfAutomaticQual',
            schema=uuid_only,
        )

        return references
