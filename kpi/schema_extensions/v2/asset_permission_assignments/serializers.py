from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    AssetPermissionAssignmentUrlField,
    AssetPermissionUrlField,
    LabelField,
    PartialPermissionField,
    UserURLField,
)

PermissionAssignmentResponse = inline_serializer_class(
    name='PermissionAssignmentResponse',
    fields={
        'url': AssetPermissionAssignmentUrlField(),
        'user': UserURLField(),
        'permission': AssetPermissionUrlField(),
        'label': LabelField(),
    },
)

PermissionAssignmentBulkRequest = inline_serializer_class(
    name='PermissionAssignmentBulkRequest',
    fields={
        'user': UserURLField(),
        'permission': AssetPermissionAssignmentUrlField(),
    },
)

PermissionAssignmentCloneRequest = inline_serializer_class(
    name='PermissionAssignmentCloneRequest',
    fields={'clone_from': serializers.CharField()},
)

PermissionAssignmentCreateRequest = inline_serializer_class(
    name='PermissionAssignmentCreateRequest',
    fields={
        'user': UserURLField(),
        'partial_permission': PartialPermissionField(),
        'permission': AssetPermissionAssignmentUrlField(),
    },
)
