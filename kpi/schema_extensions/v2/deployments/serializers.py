from rest_framework import serializers

from kpi.serializers.v2.asset import AssetSerializer
from kpi.utils.schema_extensions.serializers import inline_serializer_class


DeploymentCreateRequest = inline_serializer_class(
    name='DeploymentCreateRequest',
    fields={
        'active': serializers.BooleanField(),
    },
)

DeploymentResponse = inline_serializer_class(
    name='DeploymentResponse',
    fields={
        'backend': serializers.CharField(),
        'active': serializers.BooleanField(),
        'version_id': serializers.CharField(),
        'asset': AssetSerializer(),
    },
)

DeploymentPatchRequest = inline_serializer_class(
    name='DeploymentPatchRequest',
    fields={
        'active': serializers.BooleanField(),
        'version_id': serializers.CharField(),
    },
)
