from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    InviteUrlField,
    RecipientSenderUrlField,
    TransferField,
)


InviteResponse = inline_serializer_class(
    name='InviteResponse',
    fields={
        'url': InviteUrlField(),
        'sender |  recipient' : RecipientSenderUrlField(),
        'status': serializers.CharField(),
        'date_created': serializers.DateTimeField(),
        'date_modified': serializers.DateTimeField(),
        'transfers': TransferField(),
    },
)
