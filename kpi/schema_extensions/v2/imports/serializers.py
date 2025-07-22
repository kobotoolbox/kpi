from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import (
    ImportUrlField,
    MessagesField,
)

ImportResponse = inline_serializer_class(
    name='ImportResponse',
    fields={
        'url': ImportUrlField(),
        'status': serializers.CharField(),
        'messages': MessagesField(),
        'uid': serializers.CharField(),
        'date_created': serializers.DateTimeField(),
    },
)

ImportCreateResponse = inline_serializer_class(
    name='ImportCreateResponse',
    fields={
        'uid': serializers.CharField(),
        'url': ImportUrlField(),
        'status': serializers.CharField(),
    },
)
