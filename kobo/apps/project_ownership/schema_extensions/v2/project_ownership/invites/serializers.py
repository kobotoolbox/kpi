from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    InviteAssetField,
    InviteUrlField,
    RecipientSenderUrlField,
    TransferField,
)

ProjectInviteCreatePayload = inline_serializer_class(
    name='ProjectInviteCreatePayload',
    fields={
        'recipient': RecipientSenderUrlField(),
        'assets': InviteAssetField(),
    },
)

ProjectInviteResponse = inline_serializer_class(
    name='ProjectInviteResponse',
    fields={
        'url': InviteUrlField(),
        'sender |  recipient': RecipientSenderUrlField(),
        'status': serializers.CharField(),
        'date_created': serializers.DateTimeField(),
        'date_modified': serializers.DateTimeField(),
        'transfers': TransferField(),
    },
)

InviteUpdatePayload = inline_serializer_class(
    name='InviteUpdatePayload',
    fields={
        'status': serializers.CharField(),
    },
)
