from typing import Any

from drf_spectacular.openapi import AutoSchema
from drf_spectacular.plumbing import ComponentIdentity, ResolvedComponent

from kpi.schema_extensions.v2.generic.schema import (
    GENERIC_INT_SCHEMA,
    GENERIC_STRING_SCHEMA,
    GENERIC_UUID_SCHEMA,
)


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
        # ---------------------------------------------------------------------
        # qualInteger
        #   properties: { value: integer | null }
        # ---------------------------------------------------------------------
        references['qual_integer'] = self._register_schema_component(
            auto_schema,
            'DataSupplementManualQualDataInteger',
            {
                'type': 'object',
                'properties': {
                    'value': {
                        **GENERIC_INT_SCHEMA,
                        'nullable': True,
                    },
                    'uuid': GENERIC_UUID_SCHEMA,
                },
                'required': ['uuid', 'value'],
                'additionalProperties': False,
            },
        )

        # ---------------------------------------------------------------------
        # qualSelectMultiple
        #   properties: { value: ['507129be-2aee-4fb9-8ddd-ac766ba35f46', ...] }
        # ---------------------------------------------------------------------
        references['qual_select_multiple'] = self._register_schema_component(
            auto_schema,
            'DataSupplementManualQualDataSelectMultiple',
            {
                'type': 'object',
                'properties': {
                    'value': {
                        'type': 'array',
                        'items': GENERIC_UUID_SCHEMA,
                    },
                    'uuid': GENERIC_UUID_SCHEMA,
                },
                'required': ['uuid', 'value'],
                'additionalProperties': False,
            },
        )

        # ---------------------------------------------------------------------
        # qualSelectOne
        #   properties: { value: '0bbdb149-c85c-46c2-ad31-583377c423da' }
        # ---------------------------------------------------------------------
        references['qual_select_one'] = self._register_schema_component(
            auto_schema,
            'DataSupplementManualQualDataSelectOne',
            {
                'type': 'object',
                'properties': {
                    'value': GENERIC_UUID_SCHEMA,
                    'uuid': GENERIC_UUID_SCHEMA,
                },
                'required': ['uuid', 'value'],
                'additionalProperties': False,
            },
        )

        # ---------------------------------------------------------------------
        # qualTags
        #   properties: { value: [string, ...] }
        # ---------------------------------------------------------------------
        references['qual_tags'] = self._register_schema_component(
            auto_schema,
            'DataSupplementManualQualDataTags',
            {
                'type': 'object',
                'properties': {
                    'value': {
                        'type': 'array',
                        'items': GENERIC_STRING_SCHEMA,
                    },
                    'uuid': GENERIC_UUID_SCHEMA,
                },
                'required': ['uuid', 'value'],
                'additionalProperties': False,
            },
        )

        # ---------------------------------------------------------------------
        # qualText
        #   properties: { value: string }
        # ---------------------------------------------------------------------
        references['qual_text'] = self._register_schema_component(
            auto_schema,
            'DataSupplementManualQualDataText',
            {
                'type': 'object',
                'properties': {
                    'value': GENERIC_STRING_SCHEMA,
                    'uuid': GENERIC_UUID_SCHEMA,
                },
                'required': ['uuid', 'value'],
                'additionalProperties': False,
            },
        )

        return references
