from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    AssetUsageField,
)


OrganizationPatchPayload = inline_serializer_class(
    name='OrganizationPatchPayload',
    fields={
        'name': serializers.CharField(),
        'website': serializers.CharField(),
        'organization_type': serializers.CharField(),
    },
)
