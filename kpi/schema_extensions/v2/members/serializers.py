from rest_framework import serializers

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
        'url': MemberUrlField(),
        'user': UserUrlField(),
        'user__username': serializers.CharField(),
        'user__email': serializers.EmailField(),
        'user__extra_details__name': serializers.CharField(),
        'role': RoleChoiceField,
        'user__has_mfa_enabled': serializers.BooleanField(),
        'date_joined': serializers.DateTimeField(),
        'user__is_active': serializers.BooleanField(),
        'invite': InviteResponse(),
    },
)


MemberPatchRequest = inline_serializer_class(
    name='MemberPatchRequest',
    fields={
        'role': RoleChoicePayloadField(),
    },
)
