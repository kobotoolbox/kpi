from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class
from .fields import ImportUrlField, MessagesField

ImportCreateRequestSerializer = inline_serializer_class(
    name='ImportCreateRequestSerializer',
    fields={
        'destination': serializers.URLField(
            required=False, allow_blank=True, allow_null=True
        ),
        'url': serializers.URLField(required=False, allow_blank=True, allow_null=True),
        'name': serializers.CharField(
            required=False, allow_blank=True, allow_null=True
        ),
        'assetUid': serializers.CharField(
            required=False, allow_blank=True, allow_null=True
        ),
        'base64Encoded': serializers.CharField(
            required=False, allow_blank=True, allow_null=True
        ),
        'library': serializers.BooleanField(required=False, allow_null=True),
        'desired_type': serializers.CharField(
            required=False, allow_blank=True, allow_null=True
        ),
        'totalFiles': serializers.IntegerField(required=False, allow_null=True),
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
