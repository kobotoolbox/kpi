from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    AssetUsageField,
)

OrganizationResponse = inline_serializer_class(
    name='OrganizationResponse',
    fields={
    },
)
