from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    InviteAssetField,
    InviteUrlField,
    RecipientSenderUrlField,
    TransferField,
)

InviteCreatePayload = inline_serializer_class(
    name='InviteCreatePayload',
    fields={
        'recipient': RecipientSenderUrlField(),
        'assets': InviteAssetField(),
    },
)

InviteResponse = inline_serializer_class(
    name='InviteResponse',
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
