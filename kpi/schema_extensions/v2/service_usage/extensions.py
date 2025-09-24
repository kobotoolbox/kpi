from typing import Optional

from drf_spectacular.extensions import OpenApiSerializerFieldExtension
from drf_spectacular.plumbing import (
    ResolvedComponent,
    build_basic_type,
    build_object_type,
)
from drf_spectacular.types import OpenApiTypes

from kpi.schema_extensions.v2.generic.schema import (
    BALANCE_FIELDS_SCHEMA,
    GENERIC_NLP_ALL_TIME_OBJECT_SCHEMA,
)
from .fields import BalanceDataField

BalanceDataComponent = ResolvedComponent(
    name='ServiceUsageBalanceData',
    type=ResolvedComponent.SCHEMA,
    object=BalanceDataField,
    schema=BALANCE_FIELDS_SCHEMA,
)


def get_balance_data_ref(auto_schema):
    """Ensure component is registered and return its $ref."""
    auto_schema.registry.register_on_missing(BalanceDataComponent)
    return {'$ref': f'#/components/schemas/{BalanceDataComponent.name}'}


def get_nullable_balance_data_ref(auto_schema):
    balance_ref = get_balance_data_ref(auto_schema)
    component = ResolvedComponent(
        name='NullableServiceUsageBalanceData',
        schema={'oneOf': [balance_ref, {'type': 'null'}]},
        type=ResolvedComponent.SCHEMA,
        object=Optional[BalanceDataField],
    )
    auto_schema.registry.register_on_missing(component)
    return component.ref


class BalancesFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.service_usage.fields.BalancesField'

    def map_serializer_field(self, auto_schema, direction):
        nullable_balance = get_nullable_balance_data_ref(auto_schema)
        return build_object_type(
            properties={
                'submission': nullable_balance,
                'storage_bytes': nullable_balance,
                'asr_seconds': nullable_balance,
                'mt_characters': nullable_balance,
            },
            required=[
                'submission',
                'storage_bytes',
                'asr_seconds',
                'mt_characters',
            ],
        )


class NlpUsageFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.service_usage.fields.NlpUsageField'

    def map_serializer_field(self, auto_schema, direction):
        return GENERIC_NLP_ALL_TIME_OBJECT_SCHEMA


class SubmissionCountFieldExtension(OpenApiSerializerFieldExtension):
    target_class = 'kpi.schema_extensions.v2.service_usage.fields.SubmissionCountField'

    def map_serializer_field(self, auto_schema, direction):
        return build_object_type(
            properties={
                'all_time': build_basic_type(OpenApiTypes.INT),
                'current_period': build_basic_type(OpenApiTypes.INT),
            }
        )
