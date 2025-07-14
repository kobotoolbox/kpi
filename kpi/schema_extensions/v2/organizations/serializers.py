from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    AssetUsageField,
)

OrganizationMemberResponse = inline_serializer_class(
    name='OrganizationMemberResponse',
    fields={
    },
)
