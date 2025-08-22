from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import ImportUrlField, MessagesField

ImportCreateRequestSerializer = inline_serializer_class(
    name='ImportCreateRequestSerializer',
    fields={
        'destination': serializers.URLField(),
        'url': serializers.URLField(),
        'name': serializers.CharField(required=False, allow_blank=True),
        'assetUid': serializers.CharField(),
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
