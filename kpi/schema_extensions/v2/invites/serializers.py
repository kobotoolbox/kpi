from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    InvitedByUrlField,
    InviteesField,
    InviteRoleField,
    InviteStatusField,
    InviteUrlField,
)

InviteCreatePayload = inline_serializer_class(
    name='InviteCreatePayload',
    fields={
        'invitees': InviteesField(),
        'role': InviteRoleField,
    },
)


InviteCreateResponse = inline_serializer_class(
    name='InviteCreateResponse',
    fields={
        'url': InviteUrlField(),
        'invited_by': InvitedByUrlField(),
        'status': InviteStatusField,
        'invitee_role': InviteRoleField,
        'organization_name': serializers.CharField(),
        'created': serializers.DateTimeField(),
        'modified': serializers.DateTimeField(),
        'invitee': serializers.CharField(),
    },
)


InvitePatchPayload = inline_serializer_class(
    name='InvitePatchPayload',
    fields={
        'status': InviteStatusField,
        'role': InviteRoleField,
    },
)


InviteResponse = inline_serializer_class(
    name='InviteResponse',
    fields={
        'url': InviteUrlField(),
        'invited_by': InvitedByUrlField(),
        'status': InviteStatusField,
        'invitee_role': InviteRoleField,
        'organization_name': serializers.CharField(),
        'created': serializers.DateTimeField(),
        'modified': serializers.DateTimeField(),
    },
)
