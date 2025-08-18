from rest_framework import serializers

from kobo.apps.project_ownership.schema_extensions.v2.project_ownership.invites.fields import (  # noqa
    StatusEnumField
)
from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import InvitedByUrlField, InviteesField, InviteUrlField
from ..generic.schema import GENERIC_STRING_SCHEMA

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
        'status': StatusEnumField(),
        'invitee_role': serializers.CharField(),
        'organization_name': serializers.CharField(),
        'created': serializers.DateTimeField(),
        'modified': serializers.DateTimeField(),
        'invitee': serializers.CharField(),
    },
)
