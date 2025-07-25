from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import InvitedByUrlField, InviteesField, InviteUrlField

InviteCreatePayload = inline_serializer_class(
    name='InviteCreatePayload',
    fields={
        'invitees': InviteesField(),
        'role': serializers.CharField(),
    },
)


InvitePatchPayload = inline_serializer_class(
    name='InvitePatchPayload',
    fields={
        'status': serializers.CharField(),
        'role': serializers.CharField(),
    },
)


InviteResponse = inline_serializer_class(
    name='InviteResponse',
    fields={
        'url': InviteUrlField(),
        'invited_by': InvitedByUrlField(),
        'status': serializers.CharField(),
        'invitee_role': serializers.CharField(),
        'created': serializers.DateTimeField(),
        'modified': serializers.DateTimeField(),
        'invitee': serializers.CharField(),
    },
)
