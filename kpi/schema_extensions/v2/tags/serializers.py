from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class

TagListResponse = inline_serializer_class(
    name='TagListResponse',
    fields={
        'name': serializers.CharField(),
        'uid': serializers.CharField(),
    },
)
