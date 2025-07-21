from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    InviteField,
    MemberUrlField,
    UserUrlField,
)

MemberListResponse = inline_serializer_class(
    name='MemberListResponse',
    fields={
        'url': MemberUrlField(),
        'user': UserUrlField(),
        'user__username': serializers.CharField(),
        'user__email': serializers.EmailField(),
        'user__name': serializers.CharField(),
        'role': serializers.CharField(),
        'user__has_mfa_enabled': serializers.BooleanField(),
        'date_joined': serializers.DateTimeField(),
        'user__is_active': serializers.BooleanField(),
        'invite': InviteField(),
    },
)
