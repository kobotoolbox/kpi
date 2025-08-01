from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework.relations import HyperlinkedIdentityField

from kpi.fields import (
    WritableJSONField,
    RelativePrefixHyperlinkedRelatedField,
    PaginatedApiField,
)


def ReadOnlyFieldWithSchemaField(schema_field=None, *args, **kwargs):  # noqa N802
    if schema_field is None:
        raise ValueError('You must provide a `schema_field=` argument')

    @extend_schema_field(schema_field)
    class _DynamicField(serializers.ReadOnlyField):
        pass

    return _DynamicField(*args, **kwargs)


def HyperlinkedIdentityFieldWithSchemaField(schema_field=None, *args, **kwargs):  # noqa N802
    if schema_field is None:
        raise ValueError('You must provide a `schema_field=` argument')

    @extend_schema_field(schema_field)
    class _DynamicField(HyperlinkedIdentityField):
        pass

    return _DynamicField(*args, **kwargs)


def RelativePrefixHyperlinkedRelatedFieldWithSchemaField(  # noqa N802
    schema_field=None, *args, **kwargs
):
    if schema_field is None:
        raise ValueError('You must provide a `schema_field=` argument')

    @extend_schema_field(schema_field)
    class _DynamicField(RelativePrefixHyperlinkedRelatedField):
        pass

    return _DynamicField(*args, **kwargs)


def PaginatedApiFieldWithSchemaField(schema_field=None, *args, **kwargs):  # noqa N802
    if schema_field is None:
        raise ValueError('You must provide a `schema_field=` argument')

    @extend_schema_field(schema_field)
    class _DynamicField(PaginatedApiField):
        pass

    return _DynamicField(*args, **kwargs)


def WriteableJsonWithSchemaField(schema_field=None, *args, **kwargs):  # noqa N802
    if schema_field is None:
        raise ValueError('You must provide a `schema_field=` argument')

    @extend_schema_field(schema_field)
    class _DynamicField(WritableJSONField):
        pass

    return _DynamicField(*args, **kwargs)

