from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class

CustomerPortalPostResponse = inline_serializer_class(
    name='CustomerPortalPostResponse',
    fields={
        'url': serializers.CharField(),
    },
)
