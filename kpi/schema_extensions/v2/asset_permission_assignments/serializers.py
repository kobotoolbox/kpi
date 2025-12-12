from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    AssetPartialPermissionAssignmentField,
    AssetPermissionAssignmentUrlField,
    AssetPermissionUrlField,
    LabelField,
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

PermissionAssignmentBulkDeleteRequest = inline_serializer_class(
    name='PermissionAssignmentBulkRequest',
    fields={
        'username': serializers.CharField(),
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
        'partial_permission': AssetPartialPermissionAssignmentField(),
        'permission': AssetPermissionAssignmentUrlField(),
    },
)
