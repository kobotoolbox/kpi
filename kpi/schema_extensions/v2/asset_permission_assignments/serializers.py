from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    AssetPermissionUrlField,
    LabelField,
    PartialPermissionField,
    AssetPermissionAssignmentUrlField,
    UserField,
)

PermissionAssignmentResponse = inline_serializer_class(
    name='PermissionAssignmentResponse',
    fields={
        'url': AssetPermissionUrlField(),
        'user': UserField(),
        'permission': AssetPermissionAssignmentUrlField(),
        'label': LabelField(),
    },
)

PermissionAssignmentBulkRequest = inline_serializer_class(
    name='PermissionAssignmentBulkRequest',
    fields={
        'user': UserField(),
        'permission': AssetPermissionAssignmentUrlField(),
    },
)

PermissionAssignmentCloneRequest = inline_serializer_class(
    name='PermissionAssignmentCloneRequest',
    fields={
        'clone_from': serializers.CharField()
    }
)

PermissionAssignmentCreateRequest = inline_serializer_class(
    name='PermissionAssignmentCreateRequest',
    fields={
        'user': UserField(),
        'partial_permission': PartialPermissionField(),
        'permission': AssetPermissionAssignmentUrlField(),
    },
)
