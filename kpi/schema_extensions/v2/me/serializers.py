from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class


CurrentUserDeleteRequest = inline_serializer_class(
    name='CurrentUserDeleteRequest',
    fields={
        'confirm': serializers.CharField(),
    },
)
