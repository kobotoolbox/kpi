from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    AssetPermissionUrlField,
    LabelField,
    PartialPermissionField,
    AssetPermissionAssignmentUrlField,
    UserField,
)

PermissionResponse = inline_serializer_class(
    name='PermissionResponse',
    fields={
        'url': AssetPermissionUrlField(),
        'user': UserField(),
        'permission': AssetPermissionAssignmentUrlField(),
        'label': LabelField(),
    },
)

PermissionBulkRequest = inline_serializer_class(
    name='PermissionBulkRequest',
    fields={
        'user': UserField(),
        'permission': AssetPermissionAssignmentUrlField(),
    },
)

PermissionCloneRequest = inline_serializer_class(
    name='PermissionCloneRequest', fields={'clone_from': serializers.CharField()}
)

PermissionCreateRequest = inline_serializer_class(
    name='PermissionCreateRequest',
    fields={
        'user': UserField(),
        'partial_permission': PartialPermissionField(),
        'permission': AssetPermissionAssignmentUrlField(),
    },
)
