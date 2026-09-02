from rest_framework import serializers

from kpi.utils.schema_extensions.serializers import inline_serializer_class

EmailRequestPayload = inline_serializer_class(
    name='EmailRequestPayload',
    fields={
        'email': serializers.EmailField(),
    },
)

EmailReauthenticationRequiredResponse = inline_serializer_class(
    name='EmailReauthenticationRequiredResponse',
    fields={
        'detail': serializers.CharField(),
        'code': serializers.CharField(),
        'flows': serializers.ListField(child=serializers.DictField()),
    },
)
