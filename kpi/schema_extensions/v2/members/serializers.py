from rest_framework import serializers

from kobo.apps.organizations.serializers import OrganizationOwnershipTransferSerializer
from kpi.schema_extensions.v2.invites.serializers import InviteResponse
from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    MemberUrlField,
    RoleChoiceField,
    RoleChoicePayloadField,
    UserUrlField,
)

MemberListResponse = inline_serializer_class(
    name='MemberListResponse',
    fields={
        'url': MemberUrlField(allow_null=True),
        'user': UserUrlField(allow_null=True),
        'user__username': serializers.CharField(allow_null=True),
        'user__email': serializers.EmailField(allow_null=True),
        'user__extra_details__name': serializers.CharField(allow_null=True),
        'role': RoleChoiceField,
        'user__has_mfa_enabled': serializers.BooleanField(allow_null=True),
        'user__has_sso_enabled': serializers.BooleanField(allow_null=True),
        'date_joined': serializers.DateTimeField(allow_null=True),
        'user__is_active': serializers.BooleanField(allow_null=True),
        'invite': InviteResponse(allow_null=True),
        'pending_transfer': OrganizationOwnershipTransferSerializer(allow_null=True),
    },
)


MemberPatchRequest = inline_serializer_class(
    name='MemberPatchRequest',
    fields={
        'role': RoleChoicePayloadField(),
    },
)
